import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PersistentJob {
  upload_token: string;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  total_chunks: number;
  processed_chunks: number;
  total_images: number;
  processed_images: number;
  current_operation?: string;
  error_message?: string;
  started_at: string;
  last_activity: string;
}

export function usePersistentBackup() {
  const [activeJobs, setActiveJobs] = useState<Map<string, PersistentJob>>(new Map());
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastProgressRef = useRef<Map<string, { progress: number; timestamp: number }>>(new Map());
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // 🎯 INICIAR O REANUDAR DOWNLOAD PERSISTENTE
  const startPersistentDownload = async (backupId: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('download-complete-backup', {
        body: { 
          backup_id: backupId,
          action: 'start'
        }
      });

      if (error) throw error;

      const uploadToken = data.upload_token;
      
      // Si es un job existente, empezar a monitorear
      if (data.existing_job) {
        toast.info(data.status === 'completed' 
          ? 'Descarga previa completada' 
          : 'Reanudando descarga previa'
        );
      } else {
        toast.success('Descarga persistente iniciada');
      }

      // Iniciar polling
      startPollingJob(uploadToken);
      
      return uploadToken;
    } catch (error: any) {
      console.error('[PERSISTENT] Start error:', error);
      toast.error(`Error: ${error.message}`);
      throw error;
    }
  };

  // 🔄 POLLING PARA ESTADO PERSISTENTE
  const startPollingJob = (uploadToken: string) => {
    // Limpiar intervalo previo si existe
    if (pollingIntervals.current.has(uploadToken)) {
      clearInterval(pollingIntervals.current.get(uploadToken));
    }

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('download-complete-backup', {
          body: { 
            action: 'status',
            upload_token: uploadToken
          }
        });

        if (error) {
          console.error('[POLLING] Status error:', error);
          return;
        }

        const job = data.job as PersistentJob;
        
        // Actualizar estado local
        setActiveJobs(prev => new Map(prev.set(uploadToken, job)));

        // 🔍 DETECCIÓN INTELIGENTE DE TRABAJOS TRABADOS
        if (job.status === 'processing') {
          const lastProgress = lastProgressRef.current.get(uploadToken);
          const now = Date.now();
          
          if (lastProgress) {
            // Si el progreso no cambió en 5 minutos, está trabado
            const timeSinceLastChange = now - lastProgress.timestamp;
            const stuckThreshold = 5 * 60 * 1000; // 5 minutos
            
            if (job.progress === lastProgress.progress && timeSinceLastChange > stuckThreshold) {
              console.warn(`[STUCK DETECTION] Job ${uploadToken} stuck at ${job.progress}% for ${Math.round(timeSinceLastChange / 1000)}s`);
              
              const retries = retryCountRef.current.get(uploadToken) || 0;
              
              if (retries < 1) {
                // Intentar reanudar una vez
                toast.warning('Trabajo trabado detectado, intentando reanudar...');
                retryCountRef.current.set(uploadToken, retries + 1);
                
                // Forzar actualización del backend
                try {
                  await supabase.functions.invoke('download-complete-backup', {
                    body: { 
                      action: 'status',
                      upload_token: uploadToken,
                      force_check: true
                    }
                  });
                } catch (err) {
                  console.error('[RETRY] Error:', err);
                }
              } else {
                // Ya intentamos, marcar como fallido
                toast.error('Trabajo trabado. Usa "Exportación Estructurada" para backups grandes.');
                stopPollingJob(uploadToken);
              }
            }
          }
          
          // Actualizar último progreso conocido
          if (!lastProgress || job.progress !== lastProgress.progress) {
            lastProgressRef.current.set(uploadToken, {
              progress: job.progress,
              timestamp: now
            });
          }
        }

        // Manejar estados finales
        if (job.status === 'completed') {
          toast.success('¡Descarga persistente completada!');
          stopPollingJob(uploadToken);
          
          // Descargar archivo automáticamente
          await downloadCompletedBackup(uploadToken);
          
        } else if (job.status === 'failed') {
          toast.error(`Descarga falló: ${job.error_message}`);
          stopPollingJob(uploadToken);
        } else if (job.status === 'cancelled') {
          toast.info('Descarga cancelada');
          stopPollingJob(uploadToken);
        }

      } catch (error) {
        console.error('[POLLING] Error:', error);
      }
    }, 3000); // Poll cada 3 segundos

    pollingIntervals.current.set(uploadToken, interval);
  };

  // 🛑 DETENER POLLING
  const stopPollingJob = (uploadToken: string) => {
    if (pollingIntervals.current.has(uploadToken)) {
      clearInterval(pollingIntervals.current.get(uploadToken));
      pollingIntervals.current.delete(uploadToken);
    }
    // Limpiar refs
    lastProgressRef.current.delete(uploadToken);
    retryCountRef.current.delete(uploadToken);
  };

  // ❌ CANCELAR JOB
  const cancelPersistentJob = async (uploadToken: string) => {
    try {
      await supabase.functions.invoke('download-complete-backup', {
        body: { 
          action: 'cancel',
          upload_token: uploadToken
        }
      });
      
      stopPollingJob(uploadToken);
      setActiveJobs(prev => {
        const newMap = new Map(prev);
        newMap.delete(uploadToken);
        return newMap;
      });
      
      toast.info('Descarga cancelada');
    } catch (error: any) {
      console.error('[CANCEL] Error:', error);
      toast.error(`Error al cancelar: ${error.message}`);
    }
  };

  // 📥 DESCARGAR ARCHIVO COMPLETADO
  const downloadCompletedBackup = async (uploadToken: string) => {
    try {
      const { data: completeData, error } = await supabase.rpc(
        'complete_large_backup_upload',
        { p_upload_token: uploadToken }
      );

      if (error) throw error;

      const jsonString = typeof completeData === 'string' 
        ? completeData 
        : JSON.stringify(completeData, null, 2);
      
      const blob = new Blob([jsonString], { type: 'application/json' });
      const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-persistent-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`¡Descarga completada! ${sizeInMB} MB`);

    } catch (error: any) {
      console.error('[DOWNLOAD] Error:', error);
      toast.error(`Error al descargar: ${error.message}`);
    }
  };

  // 🔍 REANUDAR JOBS AL CARGAR LA PÁGINA
  useEffect(() => {
    const resumeActiveJobs = async () => {
      try {
        // Buscar jobs activos del usuario actual
        const { data: activeJobs, error } = await supabase
          .from('background_backup_jobs')
          .select('upload_token, status')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .in('status', ['processing'])
          .gt('last_activity', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Últimos 30 min

        if (error) throw error;

        if (activeJobs && activeJobs.length > 0) {
          toast.info(`Reanudando ${activeJobs.length} descarga(s) en segundo plano`);
          
          activeJobs.forEach(job => {
            startPollingJob(job.upload_token);
          });
        }
      } catch (error) {
        console.error('[RESUME] Error resuming jobs:', error);
      }
    };

    resumeActiveJobs();

    // Limpiar intervals al desmontar
    return () => {
      pollingIntervals.current.forEach(interval => clearInterval(interval));
      pollingIntervals.current.clear();
    };
  }, []);

  return {
    activeJobs: Array.from(activeJobs.entries()).map(([token, job]) => ({ token, ...job })),
    startPersistentDownload,
    cancelPersistentJob,
    getJobProgress: (uploadToken: string) => activeJobs.get(uploadToken)?.progress || 0,
    getJobStatus: (uploadToken: string) => activeJobs.get(uploadToken)?.status || 'unknown',
  };
}
