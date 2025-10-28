import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BackupJob {
  id: string;
  tour_id: string;
  job_type: 'full_backup' | 'media_only';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  file_size?: number;
  error_message?: string;
  total_items: number;
  processed_items: number;
  created_at: string;
  completed_at?: string;
}

interface BackupStatus {
  backupId: string;
  tourId: string;
  tourName: string;
  jobType: string;
  status: string;
  downloadUrl?: string;
  fileSize?: number;
  progress: number;
  processedItems: number;
  totalItems: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export function useBackupSystem() {
  const [activeJobs, setActiveJobs] = useState<BackupStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Check authentication on startup
  useEffect(() => {
    checkAuth();
    loadActiveJobs();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      console.log('Current user:', currentUser?.id, 'Error:', error);
      
      if (error) {
        console.error('Auth error:', error);
        toast.error('Please log in to use backup features');
        return;
      }
      
      if (!currentUser) {
        console.log('No user found, user might be logged out');
        toast.error('Please log in to use backup features');
        return;
      }
      
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking auth:', error);
    }
  };

  const loadActiveJobs = useCallback(async () => {
    try {
      console.log('Loading active backup jobs...');
      
      // Verify user is authenticated
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        console.log('User not authenticated, skipping job load');
        return;
      }

      // Get active and recent jobs from database (last 24 hours)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: jobs, error } = await supabase
        .from('backup_jobs')
        .select(`
          *,
          virtual_tours (
            title
          )
        `)
        .in('status', ['pending', 'processing', 'completed', 'failed'])
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error loading jobs:', error);
        throw error;
      }

      console.log('Found active jobs:', jobs?.length || 0);

      const activeJobsData: BackupStatus[] = (jobs || []).map(job => ({
        backupId: job.id,
        tourId: job.tour_id,
        tourName: job.virtual_tours?.title || 'Unknown Tour',
        jobType: job.job_type,
        status: job.status,
        downloadUrl: job.file_url,
        fileSize: job.file_size,
        progress: job.total_items > 0 
          ? Math.round((job.processed_items / job.total_items) * 100)
          : 0,
        processedItems: job.processed_items,
        totalItems: job.total_items,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        error: job.error_message
      }));

      setActiveJobs(activeJobsData);

      // Start polling for active jobs
      activeJobsData.forEach(job => {
        if (job.status === 'processing') {
          pollBackupStatus(job.backupId);
        }
      });

    } catch (error) {
      console.error('Error loading active jobs:', error);
    }
  }, []);

  const startBackup = async (tourId: string, backupType: 'full_backup' | 'media_only' = 'full_backup') => {
    // Check authentication first
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !currentUser) {
      console.error('User not authenticated:', authError);
      toast.error('Please log in to create backups');
      return null;
    }

    console.log('User authenticated:', currentUser.id);
    setLoading(true);
    
    try {
      console.log('Starting backup for tour:', tourId, 'type:', backupType);
      
      // Test edge function with better error handling
      const { data, error } = await supabase.functions.invoke('backup-processor', {
        body: { 
          action: 'start',
          tourId: tourId,
          backupType: backupType
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        
        // Handle different error types
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          toast.error('Authentication failed. Please log in again.');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Session refresh failed:', refreshError);
          }
        } else if (error.message.includes('Failed to fetch')) {
          toast.error('Network error: Cannot connect to backup service');
        } else {
          toast.error(`Backup service error: ${error.message}`);
        }
        return null;
      }

      if (!data) {
        toast.error('No response from backup service');
        return null;
      }

      // Check if the response indicates an error
      if (!data.success) {
        const errorMsg = data.error || 'Unknown error occurred';
        console.error('Backup failed:', {
          error: errorMsg,
          code: data.code,
          details: data.details
        });
        
        if (data.code === 'UNAUTHORIZED') {
          toast.error('Authentication error. Please log in again.');
        } else if (data.code === 'ACCESS_DENIED') {
          toast.error('You do not have permission to backup this tour');
        } else {
          toast.error(`Backup failed: ${errorMsg}`);
        }
        return null;
      }

      if (data.success) {
        const newJob: BackupStatus = {
          backupId: data.backupId,
          tourId: tourId,
          tourName: data.tourName,
          jobType: data.backupType,
          status: 'processing',
          progress: 0,
          processedItems: 0,
          totalItems: data.totalItems,
          createdAt: new Date().toISOString()
        };

        setActiveJobs(prev => [newJob, ...prev]);
        pollBackupStatus(data.backupId);
        
        toast.success(`Backup started for ${data.tourName}`);
        return data.backupId;
      } else {
        throw new Error(data.error || 'Unknown error from edge function');
      }

    } catch (error: any) {
      console.error('Error starting backup:', error);
      
      // Only show toast if we haven't already shown one above
      if (!error.message.includes('Backup failed') && !error.message.includes('Authentication')) {
        toast.error(`Unexpected error: ${error.message}`);
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const pollBackupStatus = async (backupId: string) => {
    const checkStatus = async () => {
      try {
        console.log('Polling backup status for:', backupId);
        
        const { data, error } = await supabase.functions.invoke('backup-processor', {
          body: { 
            action: 'status',
            backupId 
          }
        });

        if (error) {
          console.error('Error polling backup status:', error);
          // Retry after 10 seconds if error
          setTimeout(checkStatus, 10000);
          return;
        }

        console.log('Backup status update:', data);

        setActiveJobs(prev => 
          prev.map(job => 
            job.backupId === backupId 
              ? { ...job, ...data }
              : job
          )
        );

        // Continue polling if still processing
        if (data.status === 'processing') {
          setTimeout(checkStatus, 3000); // Every 3 seconds
        } else if (data.status === 'completed') {
          toast.success(`Backup completed: ${data.tourName}`);
          // Keep completed backups visible (don't auto-remove)
        } else if (data.status === 'failed') {
          toast.error(`Backup failed: ${data.error}`);
        }

      } catch (error) {
        console.error('Error in polling:', error);
        // Retry after 10 seconds if error
        setTimeout(checkStatus, 10000);
      }
    };

    checkStatus();
  };

  const downloadBackup = (backupStatus: BackupStatus) => {
    if (backupStatus.downloadUrl) {
      window.open(backupStatus.downloadUrl, '_blank');
      toast.success(`Downloading backup for ${backupStatus.tourName}`);
    } else {
      toast.error('No file available for download');
    }
  };

  const cancelBackup = async (backupId: string) => {
    try {
      // Update local state immediately
      setActiveJobs(prev => prev.filter(job => job.backupId !== backupId));
      
      // Here you could call an edge function to cancel the process
      toast.info('Backup cancelled');
    } catch (error) {
      toast.error('Error cancelling backup');
    }
  };

  const getJobProgress = (backupId: string): BackupStatus | undefined => {
    return activeJobs.find(job => job.backupId === backupId);
  };

  return {
    activeJobs,
    loading,
    startBackup,
    downloadBackup,
    cancelBackup,
    getJobProgress,
    refreshJobs: loadActiveJobs
  };
}
