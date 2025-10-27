import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserSettings } from './useUserSettings';

export interface MobileSettingsBackup {
  id: string;
  user_id: string;
  backup_name: string;
  description: string | null;
  settings_snapshot: any;
  device_info: any;
  created_at: string;
  is_active: boolean;
}

export const useMobileSettingsBackup = () => {
  const [backups, setBackups] = useState<MobileSettingsBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchBackups = async () => {
    try {
      const { data, error } = await supabase
        .from('mobile_settings_backup')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBackups(data || []);
    } catch (error) {
      console.error('Error fetching backups:', error);
      toast.error('Error al cargar los backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const createBackup = async (
    backupName: string,
    description: string,
    settings: UserSettings
  ) => {
    setCreating(true);
    try {
      // Capturar información del dispositivo
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      };

      // Capturar configuraciones actuales
      const settingsSnapshot = {
        user_settings: settings,
        theme_settings: {
          theme: settings.theme,
          color_scheme: settings.color_scheme,
          font_size: settings.font_size,
        },
        viewer_settings: {
          image_quality: settings.image_quality,
          data_usage: settings.data_usage,
          auto_downloads: settings.auto_downloads,
          local_storage_limit_mb: settings.local_storage_limit_mb,
          autoplay: settings.autoplay,
          default_volume: settings.default_volume,
          sound_effects: settings.sound_effects,
        },
      };

      const { data, error } = await supabase.rpc('create_mobile_settings_backup', {
        p_backup_name: backupName,
        p_description: description,
        p_settings_snapshot: settingsSnapshot as any,
        p_device_info: deviceInfo as any,
      });

      if (error) throw error;

      toast.success('Backup creado exitosamente');
      await fetchBackups();
      return data;
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Error al crear el backup');
      throw error;
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backupId: string): Promise<any> => {
    try {
      const { data, error } = await supabase.rpc('restore_mobile_settings_backup', {
        p_backup_id: backupId,
      });

      if (error) throw error;

      toast.success('Backup restaurado exitosamente');
      await fetchBackups();
      return data;
    } catch (error) {
      console.error('Error restoring backup:', error);
      toast.error('Error al restaurar el backup');
      throw error;
    }
  };

  const deleteBackup = async (backupId: string) => {
    try {
      const { error } = await supabase
        .from('mobile_settings_backup')
        .delete()
        .eq('id', backupId);

      if (error) throw error;

      toast.success('Backup eliminado');
      await fetchBackups();
    } catch (error) {
      console.error('Error deleting backup:', error);
      toast.error('Error al eliminar el backup');
      throw error;
    }
  };

  const compareBackups = (backup1: MobileSettingsBackup, backup2: MobileSettingsBackup) => {
    const settings1 = backup1.settings_snapshot;
    const settings2 = backup2.settings_snapshot;

    const differences: any[] = [];

    // Comparar user_settings
    Object.keys(settings1.user_settings).forEach((key) => {
      if (JSON.stringify(settings1.user_settings[key]) !== JSON.stringify(settings2.user_settings[key])) {
        differences.push({
          setting: key,
          backup1_value: settings1.user_settings[key],
          backup2_value: settings2.user_settings[key],
        });
      }
    });

    return differences;
  };

  return {
    backups,
    loading,
    creating,
    createBackup,
    restoreBackup,
    deleteBackup,
    compareBackups,
    refreshBackups: fetchBackups,
  };
};
