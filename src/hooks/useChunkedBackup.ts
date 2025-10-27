import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UploadProgress {
  totalChunks: number;
  uploadedChunks: number;
  percentage: number;
  status: 'idle' | 'uploading' | 'completed' | 'error' | 'cancelled';
  currentSpeed: number;
  estimatedTimeRemaining: number;
  uploadedSize: number;
  totalSize: number;
}

interface UseChunkedBackupReturn {
  uploadBackup: (data: any, backupName: string, description?: string) => Promise<string>;
  cancelUpload: () => void;
  progress: UploadProgress;
  metrics: {
    averageSpeed: number;
    totalUploads: number;
    successfulUploads: number;
  };
}

export const useChunkedBackup = (): UseChunkedBackupReturn => {
  const [progress, setProgress] = useState<UploadProgress>({
    totalChunks: 0,
    uploadedChunks: 0,
    percentage: 0,
    status: 'idle',
    currentSpeed: 0,
    estimatedTimeRemaining: 0,
    uploadedSize: 0,
    totalSize: 0
  });

  const [metrics, setMetrics] = useState({
    averageSpeed: 0,
    totalUploads: 0,
    successfulUploads: 0
  });

  const abortControllerRef = useRef<AbortController>();
  const uploadStartTimeRef = useRef<number>();
  const chunkTimingsRef = useRef<number[]>([]);

  const loadMetrics = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_backup_metrics_stats', {
        p_days: 30
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const stats = data[0];
        setMetrics({
          averageSpeed: stats.avg_chunk_size || 0,
          totalUploads: stats.total_uploads || 0,
          successfulUploads: stats.successful_uploads || 0
        });
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  }, []);

  const uploadBackup = useCallback(async (
    data: any, 
    backupName: string,
    description?: string
  ): Promise<string> => {
    const CHUNK_SIZE = 512 * 1024; // 512KB
    const MAX_CONCURRENT_UPLOADS = 3;
    
    abortControllerRef.current = new AbortController();
    uploadStartTimeRef.current = Date.now();
    chunkTimingsRef.current = [];

    try {
      const jsonString = JSON.stringify(data);
      const totalSize = new Blob([jsonString]).size;
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
      const uploadToken = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      setProgress({
        totalChunks,
        totalSize,
        uploadedChunks: 0,
        uploadedSize: 0,
        status: 'uploading',
        percentage: 0,
        currentSpeed: 0,
        estimatedTimeRemaining: 0
      });

      // Iniciar upload en la base de datos
      const { data: uploadData, error: uploadError } = await supabase.rpc(
        'start_large_backup_upload',
        {
          p_upload_token: uploadToken,
          p_total_chunks: totalChunks,
          p_chunk_size: CHUNK_SIZE,
          p_total_size: totalSize,
          p_backup_name: backupName,
          p_description: description || `Backup created at ${new Date().toISOString()}`,
          p_device_info: {
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
          }
        }
      );

      if (uploadError) throw uploadError;

      console.log('Upload initialized:', uploadToken, 'ID:', uploadData);

      // Subir chunks con límite de concurrencia
      const chunks = Array.from({ length: totalChunks }, (_, i) => i + 1);
      const uploadQueue = [...chunks];
      const activeUploads: Promise<void>[] = [];
      let uploadedCount = 0;

      const uploadChunk = async (chunkNumber: number): Promise<void> => {
        if (abortControllerRef.current?.signal.aborted) return;

        const start = (chunkNumber - 1) * CHUNK_SIZE;
        const end = start + CHUNK_SIZE;
        const chunkData = jsonString.slice(start, end);
        const chunkStartTime = Date.now();

        try {
          const chunkHash = await calculateChunkHash(chunkData);
          
          const { error } = await supabase.rpc('upload_backup_chunk', {
            p_upload_token: uploadToken,
            p_chunk_number: chunkNumber,
            p_chunk_data: chunkData,
            p_chunk_hash: chunkHash
          });

          if (error) throw error;

          const chunkDuration = Date.now() - chunkStartTime;
          chunkTimingsRef.current.push(chunkDuration);

          uploadedCount++;
          const uploadedSize = Math.min(uploadedCount * CHUNK_SIZE, totalSize);

          // Calcular métricas en tiempo real
          const averageChunkTime = chunkTimingsRef.current.reduce((a, b) => a + b, 0) / chunkTimingsRef.current.length;
          const currentSpeed = CHUNK_SIZE / (averageChunkTime / 1000); // bytes por segundo
          const remainingChunks = totalChunks - uploadedCount;
          const estimatedTimeRemaining = (remainingChunks * averageChunkTime) / 1000; // segundos

          setProgress(prev => ({
            ...prev,
            uploadedChunks: uploadedCount,
            uploadedSize,
            percentage: Math.round((uploadedCount / totalChunks) * 100),
            currentSpeed,
            estimatedTimeRemaining
          }));

          console.log(`Chunk ${chunkNumber}/${totalChunks} uploaded (${Math.round((uploadedCount / totalChunks) * 100)}%)`);

        } catch (error) {
          if (!abortControllerRef.current?.signal.aborted) {
            console.error(`Error uploading chunk ${chunkNumber}:`, error);
            throw error;
          }
        }
      };

      // Procesar cola de uploads
      while (uploadQueue.length > 0) {
        if (abortControllerRef.current?.signal.aborted) break;

        // Llenar slots concurrentes
        while (activeUploads.length < MAX_CONCURRENT_UPLOADS && uploadQueue.length > 0) {
          const chunkNumber = uploadQueue.shift()!;
          const uploadPromise = uploadChunk(chunkNumber).finally(() => {
            // Remover de activeUploads cuando complete
            const index = activeUploads.indexOf(uploadPromise);
            if (index > -1) {
              activeUploads.splice(index, 1);
            }
          });
          activeUploads.push(uploadPromise);
        }

        // Esperar que al menos un upload complete antes de continuar
        if (activeUploads.length >= MAX_CONCURRENT_UPLOADS) {
          await Promise.race(activeUploads);
        }
      }

      // Esperar todos los uploads restantes
      await Promise.all(activeUploads);

      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Upload cancelled');
      }

      console.log('All chunks uploaded, completing...');

      // Completar el upload
      const { data: completionData, error: completionError } = await supabase.rpc(
        'complete_large_backup_upload',
        { p_upload_token: uploadToken }
      );

      if (completionError) throw completionError;

      console.log('Upload completed:', completionData);

      setProgress(prev => ({ ...prev, status: 'completed', percentage: 100 }));

      // Recargar métricas
      await loadMetrics();

      return uploadToken;

    } catch (error) {
      console.error('Upload error:', error);
      setProgress(prev => ({ ...prev, status: 'error' }));
      throw error;
    }
  }, [loadMetrics]);

  const cancelUpload = useCallback(() => {
    console.log('Cancelling upload...');
    abortControllerRef.current?.abort();
    setProgress(prev => ({ ...prev, status: 'cancelled' }));
  }, []);

  // Cargar métricas al iniciar
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    uploadBackup,
    cancelUpload,
    progress,
    metrics
  };
};

// Función auxiliar para calcular hash del chunk
const calculateChunkHash = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
