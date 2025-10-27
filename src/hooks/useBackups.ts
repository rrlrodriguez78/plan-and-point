import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';

export interface Backup {
  id: string;
  user_id: string;
  tenant_id: string;
  backup_name: string;
  backup_type: 'manual' | 'automatic' | 'scheduled';
  backup_status: 'in_progress' | 'completed' | 'failed';
  backup_data: any;
  included_files: string[];
  total_size_bytes: number;
  tours_count: number;
  media_files_count: number;
  can_restore: boolean;
  restore_expiry?: string;
  created_at: string;
  completed_at?: string;
  notes?: string;
}

export function useBackups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [downloadingComplete, setDownloadingComplete] = useState(false);
  const { currentTenant } = useTenant();

  const loadBackups = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('tour_backups')
        .select('*')
        .eq('tenant_id', currentTenant.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBackups((data as Backup[]) || []);
    } catch (error: any) {
      console.error('Error loading backups:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los backups',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, [currentTenant]);

  const createBackup = async (type: 'manual' | 'automatic', name?: string, notes?: string) => {
    if (!currentTenant) {
      toast({
        title: 'Error',
        description: 'No hay tenant seleccionado',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-tour-backup', {
        body: {
          tenant_id: currentTenant.tenant_id,
          backup_type: type,
          backup_name: name,
          notes,
        },
      });

      if (error) throw error;

      toast({
        title: '✅ Backup creado',
        description: `Se han respaldado ${data.statistics.tours_count} tours`,
      });

      await loadBackups();
      return data.backup_id;
    } catch (error: any) {
      console.error('Error creating backup:', error);
      toast({
        title: 'Error al crear backup',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backupId: string, mode: 'full' | 'additive' = 'additive') => {
    setRestoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('restore-tour-backup', {
        body: {
          backup_id: backupId,
          restore_mode: mode,
        },
      });

      if (error) throw error;

      toast({
        title: '✅ Backup restaurado',
        description: `Se restauraron ${data.tours_restored} de ${data.total_tours} tours`,
      });

      return data;
    } catch (error: any) {
      console.error('Error restoring backup:', error);
      toast({
        title: 'Error al restaurar backup',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setRestoring(false);
    }
  };

  const deleteBackup = async (backupId: string) => {
    try {
      const { error } = await supabase
        .from('tour_backups')
        .delete()
        .eq('id', backupId);

      if (error) throw error;

      await supabase.from('backup_logs').insert({
        backup_id: backupId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'deleted',
      });

      toast({
        title: 'Backup eliminado',
        description: 'El backup se eliminó correctamente',
      });

      await loadBackups();
    } catch (error: any) {
      console.error('Error deleting backup:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el backup',
        variant: 'destructive',
      });
    }
  };

  const downloadBackup = async (backup: Backup) => {
    try {
      // Crear estructura completa del backup con metadata
      const completeBackup = {
        _metadata: {
          backup_id: backup.id,
          backup_name: backup.backup_name,
          created_at: backup.created_at,
          tenant_id: backup.tenant_id,
          tours_count: backup.tours_count,
          media_files_count: backup.media_files_count,
          size_bytes: backup.total_size_bytes,
        },
        data: backup.backup_data,
      };

      const blob = new Blob([JSON.stringify(completeBackup, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${backup.backup_name.replace(/\s+/g, '-')}-${new Date(backup.created_at).toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await supabase.from('backup_logs').insert({
        backup_id: backup.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'downloaded',
        details: { downloaded_at: new Date().toISOString() },
      });

      toast({
        title: '✅ Backup descargado',
        description: 'El archivo se guardó en tu PC. Guárdalo en un lugar seguro.',
      });
    } catch (error: any) {
      console.error('Error downloading backup:', error);
      toast({
        title: 'Error',
        description: 'No se pudo descargar el backup',
        variant: 'destructive',
      });
    }
  };

  const uploadAndRestoreBackup = async (file: File, mode: 'full' | 'additive' = 'additive') => {
    if (!currentTenant) {
      toast({
        title: 'Error',
        description: 'No hay tenant seleccionado',
        variant: 'destructive',
      });
      return;
    }

    setRestoring(true);
    try {
      // Leer el archivo
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);

      // Validar estructura del backup
      if (!backupData.data || !backupData._metadata) {
        throw new Error('Archivo de backup inválido o corrupto');
      }

      const { data: restoredData, error } = await supabase.functions.invoke('restore-tour-backup', {
        body: {
          backup_data: backupData.data,
          restore_mode: mode,
          tenant_id: currentTenant.tenant_id,
          is_file_upload: true,
        },
      });

      if (error) throw error;

      // Crear registro del backup importado
      await supabase.from('tour_backups').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        tenant_id: currentTenant.tenant_id,
        backup_name: `Importado: ${backupData._metadata.backup_name}`,
        backup_type: 'manual',
        backup_status: 'completed',
        backup_data: backupData.data,
        included_files: backupData.data.media_files || [],
        total_size_bytes: new Blob([fileContent]).size,
        tours_count: backupData.data.tours?.length || 0,
        media_files_count: backupData.data.media_files?.length || 0,
        completed_at: new Date().toISOString(),
        notes: `Restaurado desde archivo. Backup original: ${backupData._metadata.created_at}`,
      });

      toast({
        title: '✅ Backup restaurado desde archivo',
        description: `Se restauraron ${restoredData.tours_restored} tours correctamente`,
      });

      await loadBackups();
      return restoredData;
    } catch (error: any) {
      console.error('Error restoring from file:', error);
      toast({
        title: 'Error al restaurar backup',
        description: error.message || 'El archivo puede estar corrupto o ser incompatible',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setRestoring(false);
    }
  };

  const downloadCompleteBackup = async (backup: Backup) => {
    setDownloadingComplete(true);
    try {
      console.log('[DOWNLOAD] Starting complete backup download for:', backup.id);
      
      toast({
        title: '⏳ Iniciando descarga...',
        description: 'Preparando backup completo con imágenes en segundo plano.',
      });

      // Call edge function to start background processing
      const { data, error } = await supabase.functions.invoke(
        'download-complete-backup',
        {
          body: { backup_id: backup.id }
        }
      );

      if (error) {
        console.error('[DOWNLOAD] Edge function error:', error);
        throw error;
      }

      console.log('[DOWNLOAD] Background processing started:', data);

      // Extract upload token
      const uploadToken = data.upload_token;
      if (!uploadToken) {
        throw new Error('No upload token received');
      }

      toast({
        title: '🔄 Procesando en segundo plano...',
        description: `${data.total_images} imágenes • ~${data.estimated_size_mb} MB estimados`,
      });

      // Poll for completion with get_upload_progress
      let completed = false;
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max (5s interval)
      let lastProgress = 0;

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const { data: progressData, error: progressError } = await supabase.rpc(
          'get_upload_progress',
          { p_upload_token: uploadToken }
        );

        if (progressError) {
          console.error('[DOWNLOAD] Progress check error:', progressError);
          attempts++;
          continue;
        }

        if (progressData && progressData.length > 0) {
          const progress = progressData[0];
          
          console.log(`[DOWNLOAD] Progress: ${progress.progress_percentage}% (${progress.uploaded_chunks}/${progress.total_chunks})`);
          
          if (progress.status === 'completed') {
            completed = true;
            console.log('[DOWNLOAD] Background processing completed!');
            break;
          } else if (progress.status === 'failed' || progress.status === 'cancelled') {
            throw new Error(`Backup processing ${progress.status}`);
          }

          // Update progress toast only if changed significantly
          if (Math.abs(progress.progress_percentage - lastProgress) >= 5) {
            lastProgress = progress.progress_percentage;
            toast({
              title: '📦 Procesando imágenes...',
              description: `${progress.progress_percentage}% • ${progress.uploaded_chunks} de ${progress.total_chunks} chunks`,
            });
          }
        }

        attempts++;
      }

      if (!completed) {
        throw new Error('Timeout: El backup está tardando demasiado. Intenta con un backup más pequeño.');
      }

      console.log('[DOWNLOAD] Assembling final file...');
      
      toast({
        title: '🔧 Ensamblando archivo...',
        description: 'Combinando todos los chunks en un solo archivo',
      });

      // Get complete assembled data
      const { data: completeData, error: completeError } = await supabase.rpc(
        'complete_large_backup_upload',
        { p_upload_token: uploadToken }
      );

      if (completeError) {
        console.error('[DOWNLOAD] Assembly error:', completeError);
        throw completeError;
      }

      console.log('[DOWNLOAD] Complete backup assembled, creating download...');

      // Create blob and download
      const jsonString = typeof completeData === 'string' 
        ? completeData 
        : JSON.stringify(completeData, null, 2);
      
      const blob = new Blob([jsonString], { type: 'application/json' });
      const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
      
      console.log(`[DOWNLOAD] Final backup size: ${sizeInMB} MB`);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-complete-${backup.backup_name}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: '✅ ¡Descarga completa!',
        description: `Archivo de ${sizeInMB} MB guardado correctamente`,
      });
    } catch (error: any) {
      console.error('[DOWNLOAD] Error:', error);
      toast({
        title: 'Error al descargar',
        description: error.message || 'No se pudo completar la descarga',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setDownloadingComplete(false);
    }
  };

  const uploadAndRestoreCompleteBackup = async (
    file: File,
    mode: 'full' | 'additive' = 'additive'
  ) => {
    if (!currentTenant) {
      toast({
        title: 'Error',
        description: 'No hay tenant seleccionado',
        variant: 'destructive',
      });
      return;
    }

    setRestoring(true);
    try {
      const content = await file.text();
      const completeBackup = JSON.parse(content);

      // Validate complete backup structure
      if (!completeBackup.version || !completeBackup.backup_data || !completeBackup.images) {
        throw new Error('Formato de backup completo inválido');
      }

      const { data, error } = await supabase.functions.invoke('upload-complete-backup', {
        body: {
          complete_backup: completeBackup,
          restore_mode: mode,
          tenant_id: currentTenant.tenant_id
        }
      });

      if (error) throw error;

      toast({
        title: '✅ Backup completo restaurado',
        description: `${data.restored.tours} tours + ${data.restored.images} imágenes restauradas`,
      });

      await loadBackups();
      return data;
    } catch (error: any) {
      console.error('Error uploading and restoring complete backup:', error);
      toast({
        title: 'Error al restaurar',
        description: error.message || 'Error al restaurar backup completo',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setRestoring(false);
    }
  };

  return {
    backups,
    loading,
    creating,
    restoring,
    downloadingComplete,
    createBackup,
    restoreBackup,
    deleteBackup,
    downloadBackup,
    uploadAndRestoreBackup,
    downloadCompleteBackup,
    uploadAndRestoreCompleteBackup,
    uploadCompleteBackupChunked,
    loadBackups,
  };

  async function uploadCompleteBackupChunked(file: File, mode: 'full' | 'additive' = 'additive') {
    if (!currentTenant) {
      toast({
        title: 'Error',
        description: 'No hay tenant seleccionado',
        variant: 'destructive',
      });
      return;
    }

    setRestoring(true);
    try {
      console.log('[useBackups] Starting chunked upload for:', file.name);
      
      // Import uploader dynamically
      const { LargeBackupUploader } = await import('./useLargeBackupUploader');
      const uploader = new LargeBackupUploader();

      // Upload with progress callback
      const completeBackupData = await uploader.uploadLargeBackup(file, (progress) => {
        console.log(`[useBackups] Upload progress: ${progress}%`);
      });

      console.log('[useBackups] Upload complete, now restoring...');

      // Now restore using the uploaded data
      const { data, error } = await supabase.functions.invoke(
        'upload-complete-backup',
        {
          body: {
            complete_backup_json: completeBackupData,
            restore_mode: mode,
            tenant_id: currentTenant.tenant_id,
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Backup restaurado exitosamente",
        description: `${data.restored.tours} tours y ${data.restored.images} imágenes restauradas`,
      });

      await loadBackups();
      return data;
    } catch (error) {
      console.error('[useBackups] Error in chunked upload:', error);
      toast({
        title: "Error al restaurar",
        description: error instanceof Error ? error.message : "No se pudo restaurar el backup",
        variant: "destructive",
      });
      throw error;
    } finally {
      setRestoring(false);
    }
  }
}