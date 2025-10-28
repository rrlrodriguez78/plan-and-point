import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackupSystem } from '@/hooks/useBackupSystem';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, X, RefreshCw, Archive, Image } from 'lucide-react';

interface Tour {
  id: string;
  title: string;
  description: string | null;
  _counts?: {
    floor_plans: number;
    hotspots: number;
    panoramas: number;
  };
}

export const BackupManager: React.FC = () => {
  const { t } = useTranslation();
  const { 
    activeJobs, 
    loading, 
    startBackup, 
    downloadBackup, 
    cancelBackup 
  } = useBackupSystem();
  
  const [tours, setTours] = useState<Tour[]>([]);
  const [loadingTours, setLoadingTours] = useState(true);

  // Load available tours
  useEffect(() => {
    loadTours();
  }, []);

  const loadTours = async () => {
    try {
      setLoadingTours(true);
      
      // Fetch tours
      const { data: toursData, error: toursError } = await supabase
        .from('virtual_tours')
        .select('id, title, description')
        .order('created_at', { ascending: false });

      if (toursError) throw toursError;
      
      if (!toursData || toursData.length === 0) {
        setTours([]);
        return;
      }

      // Count elements for each tour
      const toursWithCounts = await Promise.all(
        toursData.map(async (tour) => {
          // Count floor plans
          const { count: floorPlansCount } = await supabase
            .from('floor_plans')
            .select('*', { count: 'exact', head: true })
            .eq('tour_id', tour.id);

          // Get floor plan IDs
          const { data: floorPlans } = await supabase
            .from('floor_plans')
            .select('id')
            .eq('tour_id', tour.id);
          
          const floorPlanIds = floorPlans?.map(fp => fp.id) || [];

          // Count hotspots
          let hotspotsCount = 0;
          let hotspotIds: string[] = [];
          
          if (floorPlanIds.length > 0) {
            const { count: hsCount, data: hsData } = await supabase
              .from('hotspots')
              .select('id', { count: 'exact' })
              .in('floor_plan_id', floorPlanIds);
            
            hotspotsCount = hsCount || 0;
            hotspotIds = hsData?.map(h => h.id) || [];
          }

          // Count panoramas
          let panoramasCount = 0;
          
          if (hotspotIds.length > 0) {
            const { count: panoCount } = await supabase
              .from('panorama_photos')
              .select('*', { count: 'exact', head: true })
              .in('hotspot_id', hotspotIds);
            
            panoramasCount = panoCount || 0;
          }

          return {
            ...tour,
            _counts: {
              floor_plans: floorPlansCount || 0,
              hotspots: hotspotsCount,
              panoramas: panoramasCount,
            },
          };
        })
      );

      setTours(toursWithCounts);
    } catch (error: any) {
      console.error('Error loading tours:', error);
      toast.error(t('backups.errorLoadingTours', { defaultValue: 'Error loading tours' }));
    } finally {
      setLoadingTours(false);
    }
  };

  const handleStartBackup = async (tourId: string, backupType: 'full_backup' | 'media_only') => {
    const tour = tours.find(t => t.id === tourId);
    if (!tour) return;

    const backupId = await startBackup(tourId, backupType);
    if (backupId) {
      toast.success(t('backups.backupStarted', { 
        defaultValue: 'Backup for {{tourName}} started',
        tourName: tour.title 
      }));
    }
  };

  const handleDownload = (job: any) => {
    downloadBackup(job);
  };

  const handleCancel = (backupId: string) => {
    cancelBackup(backupId);
  };

  const getTourStats = (tour: Tour) => {
    const counts = tour._counts || { floor_plans: 0, hotspots: 0, panoramas: 0 };
    return {
      floorPlans: counts.floor_plans,
      photos: counts.panoramas,
      hotspots: counts.hotspots
    };
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing': return t('backups.statusProcessing', { defaultValue: 'Processing' });
      case 'completed': return t('backups.statusCompleted', { defaultValue: 'Completed' });
      case 'failed': return t('backups.statusFailed', { defaultValue: 'Failed' });
      default: return t('backups.statusPending', { defaultValue: 'Pending' });
    }
  };

  if (loadingTours) {
    return (
      <div className="flex justify-center items-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('backups.loadingTours', { defaultValue: 'Loading tours...' })}</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t('backups.title', { defaultValue: 'Backup System' })}</h1>
        <p className="text-muted-foreground mt-2">
          {t('backups.subtitle', { defaultValue: 'Create complete backups or media-only exports for your virtual tours' })}
        </p>
      </div>

      {/* Available Tours */}
      <Card>
        <CardHeader>
          <CardTitle>{t('backups.availableTours', { defaultValue: 'Available Tours' })}</CardTitle>
          <CardDescription>
            {t('backups.selectTourDescription', { defaultValue: 'Select a tour to create a backup' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tours.map((tour) => {
              const stats = getTourStats(tour);
              const hasActiveJob = activeJobs.some(job => job.tourId === tour.id);
              
              return (
                <Card key={tour.id} className="relative">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg">{tour.title}</h3>
                        {tour.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {tour.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>🗺️ {stats.floorPlans} plans</span>
                        <span>📸 {stats.photos} photos</span>
                        <span>📍 {stats.hotspots} points</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleStartBackup(tour.id, 'full_backup')}
                          disabled={loading || hasActiveJob}
                          className="flex-1"
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          {t('backups.complete', { defaultValue: 'Complete' })}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartBackup(tour.id, 'media_only')}
                          disabled={loading || hasActiveJob}
                          className="flex-1"
                        >
                          <Image className="h-4 w-4 mr-2" />
                          {t('backups.mediaOnly', { defaultValue: 'Media Only' })}
                        </Button>
                      </div>

                      {hasActiveJob && (
                        <Badge variant="secondary" className="w-full justify-center">
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          {t('backups.backupInProgress', { defaultValue: 'Backup in progress' })}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {tours.length === 0 && (
            <div className="text-center py-8">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('backups.noToursAvailable', { defaultValue: 'No tours available for backup' })}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Backups */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('backups.activeBackups', { defaultValue: 'Active Backups' })}</CardTitle>
            <CardDescription>
              {t('backups.trackBackupsDescription', { defaultValue: 'Track backups currently being processed' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <div key={job.backupId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{job.tourName}</span>
                        <Badge 
                          variant="secondary" 
                          className={getStatusColor(job.status)}
                        >
                          {getStatusText(job.status)}
                        </Badge>
                        <Badge variant="outline">
                          {job.jobType === 'full_backup' 
                            ? `💾 ${t('backups.complete', { defaultValue: 'Complete' })}` 
                            : `🖼️ ${t('backups.mediaOnly', { defaultValue: 'Media Only' })}`}
                        </Badge>
                      </div>
                      
                      {job.fileSize && (
                        <span className="text-sm text-muted-foreground">
                          {formatFileSize(job.fileSize)}
                        </span>
                      )}
                    </div>

                    {job.status === 'processing' && (
                      <div className="space-y-1">
                        <Progress value={job.progress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {t('backups.itemsProgress', { 
                              defaultValue: '{{processed}} of {{total}} items',
                              processed: job.processedItems,
                              total: job.totalItems
                            })}
                          </span>
                          <span>{job.progress}%</span>
                        </div>
                      </div>
                    )}

                    {job.error && (
                      <p className="text-sm text-red-600">{job.error}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {job.status === 'completed' && job.downloadUrl && (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(job)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t('backups.download', { defaultValue: 'Download' })}
                      </Button>
                    )}
                    
                    {job.status === 'processing' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(job.backupId)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        {t('backups.cancel', { defaultValue: 'Cancel' })}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('backups.backupTypes', { defaultValue: 'Backup Types' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Archive className="h-5 w-5 text-blue-500" />
                <h4 className="font-semibold">{t('backups.completeBackup', { defaultValue: 'Complete Backup' })}</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('backups.completeBackupDescription', { 
                  defaultValue: 'Includes the entire tour structure: metadata, floor plans, hotspots, and all 360° photos. Ideal for complete restoration.' 
                })}
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Image className="h-5 w-5 text-green-500" />
                <h4 className="font-semibold">{t('backups.mediaOnlyBackup', { defaultValue: 'Media Only' })}</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('backups.mediaOnlyDescription', { 
                  defaultValue: 'Includes only 360° photos and floor plans, organized in folders. Ideal for file delivery or platform migration.' 
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
