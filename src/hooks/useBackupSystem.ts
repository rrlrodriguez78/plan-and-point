import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================================
// TIPOS
// ============================================================

interface BackupJob {
  id: string;
  user_id: string;
  tenant_id: string;
  tour_id: string;
  job_type: 'full_backup' | 'media_only';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  file_url: string | null;
  file_size: number | null;
  error_message: string | null;
  total_items: number;
  processed_items: number;
  progress_percentage: number;
  metadata: any;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface BackupStatus {
  backupId: string;
  tourId: string;
  tourName: string;
  jobType: 'full_backup' | 'media_only';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  downloadUrl?: string;
  fileSize?: number;
  progress: number;
  processedItems: number;
  totalItems: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
  metadata?: any;
}

// ============================================================
// HOOK PRINCIPAL
// ============================================================

export function useBackupSystem() {
  const [activeJobs, setActiveJobs] = useState<BackupStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ============================================================
  // CARGAR JOBS ACTIVOS
  // ============================================================

  const loadActiveJobs = useCallback(async () => {
    try {
      const { data: jobs, error } = await supabase
        .from('backup_jobs')
        .select(`
          *,
          virtual_tours (
            title
          )
        `)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[BACKUP] Error cargando jobs:', error);
        throw error;
      }

      const activeJobsData: BackupStatus[] = (jobs || []).map(job => ({
        backupId: job.id,
        tourId: job.tour_id,
        tourName: job.virtual_tours?.title || 'Tour desconocido',
        jobType: job.job_type as 'full_backup' | 'media_only',
        status: job.status as BackupStatus['status'],
        downloadUrl: job.file_url || undefined,
        fileSize: job.file_size || undefined,
        progress: job.progress_percentage,
        processedItems: job.processed_items,
        totalItems: job.total_items,
        createdAt: job.created_at,
        completedAt: job.completed_at || undefined,
        error: job.error_message || undefined,
        metadata: job.metadata,
      }));

      setActiveJobs(activeJobsData);

      // Iniciar polling para jobs en proceso
      activeJobsData.forEach(job => {
        if (job.status === 'processing') {
          startPollingJob(job.backupId);
        }
      });

    } catch (error) {
      console.error('[BACKUP] Error al cargar jobs activos:', error);
      toast.error('Error al cargar trabajos de backup');
    }
  }, []);

  // ============================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================

  useEffect(() => {
    loadActiveJobs();

    // Suscribirse a cambios en backup_jobs
    const channel = supabase
      .channel('backup_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'backup_jobs',
        },
        (payload) => {
          console.log('[BACKUP] Realtime update:', payload);
          
          if (payload.eventType === 'INSERT') {
            handleRealtimeInsert(payload.new as BackupJob);
          } else if (payload.eventType === 'UPDATE') {
            handleRealtimeUpdate(payload.new as BackupJob);
          } else if (payload.eventType === 'DELETE') {
            handleRealtimeDelete(payload.old.id);
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
      
      // Limpiar todos los intervalos de polling
      pollingIntervalsRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      pollingIntervalsRef.current.clear();
    };
  }, [loadActiveJobs]);

  // ============================================================
  // HANDLERS REALTIME
  // ============================================================

  const handleRealtimeInsert = (job: BackupJob) => {
    const newJob: BackupStatus = {
      backupId: job.id,
      tourId: job.tour_id,
      tourName: 'Cargando...', // Se actualizará con el fetch
      jobType: job.job_type,
      status: job.status,
      downloadUrl: job.file_url || undefined,
      fileSize: job.file_size || undefined,
      progress: job.progress_percentage,
      processedItems: job.processed_items,
      totalItems: job.total_items,
      createdAt: job.created_at,
      completedAt: job.completed_at || undefined,
      error: job.error_message || undefined,
      metadata: job.metadata,
    };

    setActiveJobs(prev => {
      // Evitar duplicados
      if (prev.some(j => j.backupId === job.id)) {
        return prev;
      }
      return [newJob, ...prev];
    });

    if (job.status === 'processing') {
      startPollingJob(job.id);
    }
  };

  const handleRealtimeUpdate = (job: BackupJob) => {
    setActiveJobs(prev =>
      prev.map(j =>
        j.backupId === job.id
          ? {
              ...j,
              status: job.status,
              downloadUrl: job.file_url || undefined,
              fileSize: job.file_size || undefined,
              progress: job.progress_percentage,
              processedItems: job.processed_items,
              totalItems: job.total_items,
              completedAt: job.completed_at || undefined,
              error: job.error_message || undefined,
              metadata: job.metadata,
            }
          : j
      )
    );

    // Detener polling si completó o falló
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      stopPollingJob(job.id);
      
      if (job.status === 'completed') {
        toast.success('✅ Backup completado y listo para descargar');
      } else if (job.status === 'failed') {
        toast.error(`❌ Backup falló: ${job.error_message || 'Error desconocido'}`);
      } else if (job.status === 'cancelled') {
        toast.info('🚫 Backup cancelado');
      }

      // Remover de lista después de 30s si completó/falló
      setTimeout(() => {
        setActiveJobs(prev => prev.filter(j => j.backupId !== job.id));
      }, 30000);
    }
  };

  const handleRealtimeDelete = (jobId: string) => {
    setActiveJobs(prev => prev.filter(j => j.backupId !== jobId));
    stopPollingJob(jobId);
  };

  // ============================================================
  // POLLING (FALLBACK SI REALTIME FALLA)
  // ============================================================

  const startPollingJob = (backupId: string) => {
    // Evitar duplicar polling
    if (pollingIntervalsRef.current.has(backupId)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('backup-processor', {
          body: {
            action: 'status',
            backupId,
          },
        });

        if (error) {
          console.error('[BACKUP] Error en polling:', error);
          return;
        }

        // Actualizar estado
        setActiveJobs(prev =>
          prev.map(job =>
            job.backupId === backupId
              ? {
                  ...job,
                  status: data.status,
                  progress: data.progress,
                  processedItems: data.processedItems,
                  totalItems: data.totalItems,
                  downloadUrl: data.downloadUrl,
                  fileSize: data.fileSize,
                  completedAt: data.completedAt,
                  error: data.error,
                }
              : job
          )
        );

        // Detener polling si terminó
        if (data.status !== 'pending' && data.status !== 'processing') {
          stopPollingJob(backupId);
        }
      } catch (error) {
        console.error('[BACKUP] Error en polling:', error);
      }
    }, 3000); // Cada 3 segundos

    pollingIntervalsRef.current.set(backupId, interval);
  };

  const stopPollingJob = (backupId: string) => {
    const interval = pollingIntervalsRef.current.get(backupId);
    if (interval) {
      clearInterval(interval);
      pollingIntervalsRef.current.delete(backupId);
    }
  };

  // ============================================================
  // INICIAR BACKUP
  // ============================================================

  const startBackup = async (
    tourId: string,
    backupType: 'full_backup' | 'media_only' = 'full_backup'
  ): Promise<string | null> => {
    setLoading(true);

    try {
      console.log(`[BACKUP] Iniciando ${backupType} para tour: ${tourId}`);

      const { data, error } = await supabase.functions.invoke('backup-processor', {
        body: {
          action: 'start',
          tourId,
          backupType,
        },
      });

      if (error) {
        console.error('[BACKUP] Error de edge function:', error);
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.success) {
        toast.success(`🚀 Backup iniciado: ${data.tourName}`);
        
        // El realtime se encargará de añadirlo a activeJobs
        // pero podemos iniciarlo manualmente como fallback
        const newJob: BackupStatus = {
          backupId: data.backupId,
          tourId: tourId,
          tourName: data.tourName,
          jobType: data.backupType,
          status: 'processing',
          progress: 0,
          processedItems: 0,
          totalItems: data.totalItems,
          createdAt: new Date().toISOString(),
        };

        setActiveJobs(prev => [newJob, ...prev]);
        startPollingJob(data.backupId);

        return data.backupId;
      } else {
        throw new Error('Respuesta inesperada del servidor');
      }
    } catch (error: any) {
      console.error('[BACKUP] Error iniciando backup:', error);
      const errorMessage = error.message || 'Error desconocido al iniciar backup';
      toast.error(`❌ ${errorMessage}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // DESCARGAR BACKUP
  // ============================================================

  const downloadBackup = (backupStatus: BackupStatus) => {
    if (backupStatus.downloadUrl) {
      const link = document.createElement('a');
      link.href = backupStatus.downloadUrl;
      link.download = `backup-${backupStatus.tourName}-${new Date().toISOString()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`📥 Descargando: ${backupStatus.tourName}`);
    } else {
      toast.error('❌ No hay archivo disponible para descargar');
    }
  };

  // ============================================================
  // CANCELAR BACKUP
  // ============================================================

  const cancelBackup = async (backupId: string) => {
    try {
      // Actualizar estado en DB
      const { error } = await supabase
        .from('backup_jobs')
        .update({ status: 'cancelled' })
        .eq('id', backupId);

      if (error) throw error;

      stopPollingJob(backupId);
      setActiveJobs(prev => prev.filter(job => job.backupId !== backupId));
      
      toast.info('🚫 Backup cancelado');
    } catch (error: any) {
      console.error('[BACKUP] Error al cancelar:', error);
      toast.error(`❌ Error al cancelar: ${error.message}`);
    }
  };

  // ============================================================
  // OBTENER PROGRESO
  // ============================================================

  const getJobProgress = (backupId: string): BackupStatus | undefined => {
    return activeJobs.find(job => job.backupId === backupId);
  };

  // ============================================================
  // RETURN
  // ============================================================

  return {
    activeJobs,
    loading,
    startBackup,
    downloadBackup,
    cancelBackup,
    getJobProgress,
    refreshJobs: loadActiveJobs,
  };
}
