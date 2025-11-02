import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState, useCallback, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Map, Upload } from "lucide-react";
import { SyncProgressDialog } from "./SyncProgressDialog";

interface Tour {
  id: string;
  title: string;
  tenant_id: string;
}

interface SyncJob {
  id: string;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  processed_items: number;
  failed_items: number;
  error_messages: Array<{ photoId: string; error: string }>;
}

interface Props {
  tenantId: string;
}

export const BatchPhotoSync: React.FC<Props> = ({ tenantId }) => {
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingFloorPlans, setSyncingFloorPlans] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  
  // New job-based states
  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null);
  const [alreadySyncedCount, setAlreadySyncedCount] = useState(0);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Old progress states (for floor plans)
  const [progress, setProgress] = useState<{
    synced: number;
    failed: number;
    total: number;
    alreadySynced: number;
  } | null>(null);
  const [floorPlanProgress, setFloorPlanProgress] = useState<{
    synced: number;
    failed: number;
    total: number;
    alreadySynced: number;
  } | null>(null);
  const [errors, setErrors] = useState<Array<{ photoId: string; error: string }>>([]);
  const [floorPlanErrors, setFloorPlanErrors] = useState<string[]>([]);

  useEffect(() => {
    loadTours();
    
    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [tenantId]);

  // Check for active jobs on mount
  useEffect(() => {
    const checkActiveJobs = async () => {
      if (!tenantId) return;
      
      const { data: activeJobs, error } = await supabase
        .from('sync_jobs')
        .select('id, status, processed_items, total_items, job_type')
        .eq('tenant_id', tenantId)
        .in('status', ['processing', 'pending'])
        .order('started_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error checking active jobs:', error);
        return;
      }
      
      if (activeJobs && activeJobs.length > 0) {
        const job = activeJobs[0];
        console.log('📋 Found active job on page load:', job.id);
        setShowProgressDialog(true);
        
        // Start polling manually without calling startPolling yet (to avoid dependency issues)
        pollJobProgress(job.id);
        const intervalId = setInterval(() => {
          pollJobProgress(job.id);
        }, 2000);
        pollingIntervalRef.current = intervalId;
        
        toast.info('Reanudando sincronización en progreso...');
      }
    };
    
    checkActiveJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const loadTours = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('virtual_tours')
        .select('id, title, tenant_id')
        .eq('tenant_id', tenantId)
        .order('title');

      if (error) throw error;
      setTours(data || []);
    } catch (error) {
      console.error('Error loading tours:', error);
      toast.error('Error al cargar tours');
    } finally {
      setLoading(false);
    }
  };

  // Poll job progress
  const pollJobProgress = useCallback(async (jobId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          action: 'get_progress',
          jobId
        }
      });

      if (error) throw error;

      if (data.success && data.job) {
        setCurrentJob(data.job);

        // Stop polling if job is complete
        if (['completed', 'failed', 'cancelled'].includes(data.job.status)) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Show final notification
          if (data.job.status === 'completed') {
            const successCount = data.job.processed_items - data.job.failed_items;
            if (data.job.failed_items === 0) {
              toast.success(`✅ ${successCount} fotos sincronizadas exitosamente`);
            } else {
              toast.warning(`⚠️ ${successCount} sincronizadas, ${data.job.failed_items} fallidas`);
            }
          } else if (data.job.status === 'cancelled') {
            toast.info('Sincronización cancelada');
          } else if (data.job.status === 'failed') {
            toast.error('Sincronización fallida');
          }
        }
      }
    } catch (error) {
      console.error('Error polling job:', error);
    }
  }, []);

  // Start polling
  const startPolling = useCallback((jobId: string) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll immediately
    pollJobProgress(jobId);

    // Then poll every 2 seconds
    pollingIntervalRef.current = setInterval(() => {
      pollJobProgress(jobId);
    }, 2000);
  }, [pollJobProgress]);

  // Cancel job
  const handleCancelJob = async () => {
    if (!currentJob) return;

    try {
      const { data, error } = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          action: 'cancel_job',
          jobId: currentJob.id
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.info('Cancelando sincronización...');
        // Update will come from next poll
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      toast.error('Error al cancelar');
    }
  };

  // New handleSync with job-based approach
  const handleSync = async () => {
    if (!selectedTourId) {
      toast.error('Selecciona un tour');
      return;
    }

    setSyncing(true);
    setCurrentJob(null);
    setAlreadySyncedCount(0);

    try {
      const { data, error } = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          action: 'start_job',
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (error) throw error;

      if (data.success && data.jobId) {
        setAlreadySyncedCount(data.alreadySynced || 0);
        setShowProgressDialog(true);
        toast.info(`🚀 Iniciando sincronización de ${data.totalPhotos} fotos...`);
        
        // Start polling for progress
        startPolling(data.jobId);
      } else if (data.success && !data.jobId) {
        // No photos to sync
        toast.info(data.message);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncFloorPlans = async () => {
    if (!selectedTourId) {
      toast.error('Selecciona un tour');
      return;
    }

    setSyncingFloorPlans(true);
    setFloorPlanProgress(null);
    setFloorPlanErrors([]);

    try {
      const { data, error } = await supabase.functions.invoke('sync-all-floor-plans', {
        body: {
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (error) throw error;

      if (data.success) {
        setFloorPlanProgress({
          synced: data.synced,
          failed: data.failed,
          total: data.total,
          alreadySynced: data.alreadySynced || 0
        });
        setFloorPlanErrors(data.errors || []);

        if (data.failed === 0) {
          toast.success(`✅ ${data.synced} planos de piso sincronizados`);
        } else {
          toast.warning(`⚠️ ${data.synced} sincronizados, ${data.failed} fallidos`);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Floor plan sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Error al sincronizar planos');
    } finally {
      setSyncingFloorPlans(false);
    }
  };

  const handleSyncAll = async () => {
    if (!selectedTourId) {
      toast.error('Selecciona un tour');
      return;
    }

    setSyncingAll(true);
    setCurrentJob(null);
    setAlreadySyncedCount(0);
    setFloorPlanProgress(null);
    setFloorPlanErrors([]);

    try {
      // PASO 1: Sincronizar Floor Plans
      toast.info('🗺️ Paso 1/2: Sincronizando planos de piso...');
      setSyncingFloorPlans(true);

      const floorPlansResult = await supabase.functions.invoke('sync-all-floor-plans', {
        body: {
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (floorPlansResult.error) throw floorPlansResult.error;

      if (floorPlansResult.data.success) {
        setFloorPlanProgress({
          synced: floorPlansResult.data.synced,
          failed: floorPlansResult.data.failed,
          total: floorPlansResult.data.total,
          alreadySynced: floorPlansResult.data.alreadySynced || 0
        });
        setFloorPlanErrors(floorPlansResult.data.errors || []);

        if (floorPlansResult.data.failed === 0) {
          toast.success(`✅ Paso 1/2: ${floorPlansResult.data.synced} planos sincronizados`);
        } else {
          toast.warning(`⚠️ Paso 1/2: ${floorPlansResult.data.synced} planos sincronizados, ${floorPlansResult.data.failed} fallidos`);
        }
      }

      setSyncingFloorPlans(false);

      // PASO 2: Sincronizar Fotos con job system
      toast.info('📸 Paso 2/2: Sincronizando fotos panorámicas...');
      setSyncing(true);

      const photosResult = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          action: 'start_job',
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (photosResult.error) throw photosResult.error;

      if (photosResult.data.success && photosResult.data.jobId) {
        setAlreadySyncedCount(photosResult.data.alreadySynced || 0);
        setShowProgressDialog(true);
        toast.info(`🚀 Sincronizando ${photosResult.data.totalPhotos} fotos...`);
        
        // Start polling for progress
        startPolling(photosResult.data.jobId);
      } else if (photosResult.data.success && !photosResult.data.jobId) {
        toast.info(photosResult.data.message);
      }

    } catch (error) {
      console.error('Sync all error:', error);
      toast.error(error instanceof Error ? error.message : 'Error durante la sincronización');
    } finally {
      setSyncing(false);
      setSyncingFloorPlans(false);
      setSyncingAll(false);
    }
  };

  const progressPercent = progress 
    ? ((progress.synced + progress.failed) / progress.total) * 100 
    : 0;

  return (
    <>
      <SyncProgressDialog 
        open={showProgressDialog}
        job={currentJob}
        alreadySynced={alreadySyncedCount}
        onClose={() => setShowProgressDialog(false)}
        onCancel={handleCancelJob}
      />
      
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Sincronizar Fotos Existentes
        </CardTitle>
        <CardDescription>
          Sincroniza retroactivamente las fotos de un tour a Google Drive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Seleccionar Tour</label>
          <Select
            value={selectedTourId}
            onValueChange={setSelectedTourId}
            disabled={loading || syncing || syncingFloorPlans || syncingAll}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un tour..." />
            </SelectTrigger>
            <SelectContent>
              {tours.map(tour => (
                <SelectItem key={tour.id} value={tour.id}>
                  {tour.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleSyncAll}
          disabled={!selectedTourId || syncingAll}
          className="w-full"
          size="lg"
        >
          <Upload className="h-5 w-5 mr-2" />
          {syncingAll 
            ? syncingFloorPlans 
              ? "📍 Sincronizando planos..." 
              : syncing 
                ? "📸 Sincronizando fotos..." 
                : "Sincronizando..."
            : "Sincronizar Todo (Planos + Fotos)"
          }
        </Button>

        {progress && (
          <div className="space-y-3 pt-4 border-t">
            <div className="font-semibold text-sm">Fotos Panorámicas</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Progreso</span>
                <span className="text-muted-foreground">
                  {progress.synced + progress.failed} / {progress.total} fotos
                </span>
              </div>
              <Progress value={((progress.synced + progress.failed) / progress.total) * 100} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                <div className="text-green-600 dark:text-green-400 font-medium">✓ Sincronizadas</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{progress.synced}</div>
              </div>

              {progress.alreadySynced > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
                  <div className="text-blue-600 dark:text-blue-400 font-medium">⏭ Ya existían</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{progress.alreadySynced}</div>
                </div>
              )}

              {progress.failed > 0 && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
                  <div className="text-red-600 dark:text-red-400 font-medium">✗ Fallidas</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{progress.failed}</div>
                </div>
              )}
            </div>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1">Errores encontrados:</div>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {errors.map((err, idx) => (
                      <li key={idx} className="font-mono">
                        Photo {err.photoId.slice(0, 8)}: {err.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {floorPlanProgress && (
          <div className="space-y-3 pt-4 border-t">
            <div className="font-semibold text-sm">Planos de Piso</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Progreso</span>
                <span className="text-muted-foreground">
                  {floorPlanProgress.synced + floorPlanProgress.failed} / {floorPlanProgress.total} planos
                </span>
              </div>
              <Progress value={((floorPlanProgress.synced + floorPlanProgress.failed) / floorPlanProgress.total) * 100} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                <div className="text-green-600 dark:text-green-400 font-medium">✓ Sincronizados</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{floorPlanProgress.synced}</div>
              </div>

              {floorPlanProgress.alreadySynced > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
                  <div className="text-blue-600 dark:text-blue-400 font-medium">⏭ Ya existían</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{floorPlanProgress.alreadySynced}</div>
                </div>
              )}

              {floorPlanProgress.failed > 0 && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
                  <div className="text-red-600 dark:text-red-400 font-medium">✗ Fallidos</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{floorPlanProgress.failed}</div>
                </div>
              )}
            </div>

            {floorPlanErrors.length > 0 && (
              <Alert variant="destructive">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1">Errores encontrados:</div>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {floorPlanErrors.map((error, idx) => (
                      <li key={idx} className="font-mono">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
};
