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
      const blob = new Blob([JSON.stringify(backup.backup_data, null, 2)], {
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

      toast({
        title: 'Backup descargado',
        description: 'El archivo se descargó correctamente',
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

  return {
    backups,
    loading,
    creating,
    restoring,
    createBackup,
    restoreBackup,
    deleteBackup,
    downloadBackup,
    loadBackups,
  };
}