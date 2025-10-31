import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BackupDestination {
  id: string;
  tenant_id: string;
  destination_type: 'cloud_storage' | 'local_download' | 'both';
  cloud_provider: 'google_drive' | 'dropbox' | null;
  cloud_folder_id: string | null;
  cloud_folder_path: string | null;
  auto_backup_enabled: boolean;
  backup_on_photo_upload: boolean;
  backup_frequency: string;
  is_active: boolean;
  last_backup_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncHistory {
  id: string;
  destination_id: string;
  backup_job_id: string;
  sync_type: string;
  status: string;
  files_synced: number;
  files_failed: number;
  total_size_bytes: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export function useCloudStorage(tenantId: string) {
  const [destinations, setDestinations] = useState<BackupDestination[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId) {
      loadDestinations();
      loadSyncHistory();
    }
  }, [tenantId]);

  const loadDestinations = async () => {
    try {
      const { data, error } = await supabase
        .from('backup_destinations')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      setDestinations((data as BackupDestination[]) || []);
    } catch (error: any) {
      console.error('Error loading destinations:', error);
      toast.error('Error loading backup destinations');
    }
  };

  const loadSyncHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('backup_sync_history')
        .select(`
          *,
          backup_destinations!inner(tenant_id)
        `)
        .eq('backup_destinations.tenant_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSyncHistory(data || []);
    } catch (error: any) {
      console.error('Error loading sync history:', error);
    }
  };

  const connectProvider = async (provider: 'google_drive' | 'dropbox') => {
    try {
      setLoadingProvider(provider);
      const { data, error } = await supabase.functions.invoke('cloud-storage-auth', {
        body: { 
          action: 'authorize',
          provider,
          tenantId
        }
      });

      if (error) throw error;

      // Redirect to OAuth URL
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      console.error('Error connecting provider:', error);
      toast.error(`Error connecting to ${provider}`);
    } finally {
      setLoadingProvider(null);
    }
  };

  const disconnectProvider = async (destinationId: string) => {
    try {
      setLoadingProvider('disconnecting');
      const { error } = await supabase
        .from('backup_destinations')
        .update({ is_active: false })
        .eq('id', destinationId);

      if (error) throw error;

      await loadDestinations();
      toast.success('Provider disconnected');
    } catch (error: any) {
      console.error('Error disconnecting provider:', error);
      toast.error('Error disconnecting provider');
    } finally {
      setLoadingProvider(null);
    }
  };

  const testConnection = async (destinationId: string) => {
    try {
      setLoadingProvider('testing');
      const { data, error } = await supabase.functions.invoke('cloud-storage-auth', {
        body: { 
          action: 'test-connection',
          destinationId
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Connection test successful');
      } else {
        toast.error('Connection test failed');
      }

      return data.success;
    } catch (error: any) {
      console.error('Error testing connection:', error);
      toast.error('Error testing connection');
      return false;
    } finally {
      setLoadingProvider(null);
    }
  };

  const updateDestinationType = async (
    destinationId: string,
    type: 'cloud_storage' | 'local_download' | 'both'
  ) => {
    try {
      setLoadingProvider('updating');
      const { error } = await supabase
        .from('backup_destinations')
        .update({ destination_type: type })
        .eq('id', destinationId);

      if (error) throw error;

      await loadDestinations();
      toast.success('Destination type updated');
    } catch (error: any) {
      console.error('Error updating destination type:', error);
      toast.error('Error updating destination type');
    } finally {
      setLoadingProvider(null);
    }
  };

  const toggleAutoBackup = async (destinationId: string, enabled: boolean) => {
    try {
      setLoadingProvider('updating');
      const { error } = await supabase
        .from('backup_destinations')
        .update({ auto_backup_enabled: enabled })
        .eq('id', destinationId);

      if (error) throw error;

      await loadDestinations();
      toast.success(`Auto-backup ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      console.error('Error toggling auto-backup:', error);
      toast.error('Error updating auto-backup setting');
    } finally {
      setLoadingProvider(null);
    }
  };

  const getActiveDestination = () => {
    return destinations.find(d => d.is_active) || null;
  };

  return {
    destinations,
    syncHistory,
    loadingProvider,
    connectProvider,
    disconnectProvider,
    testConnection,
    updateDestinationType,
    toggleAutoBackup,
    loadDestinations,
    loadSyncHistory,
    getActiveDestination
  };
}
