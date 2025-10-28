import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackupSystem } from '@/hooks/useBackupSystem';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Download, X, RefreshCw, Archive, Image, Trash2, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    cancelBackup,
    refreshJobs,
    processQueue
  } = useBackupSystem();
  
  const [tours, setTours] = useState<Tour[]>([]);
  const [loadingTours, setLoadingTours] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [expandedBackups, setExpandedBackups] = useState<Set<string>>(new Set());
  const [showCompletedBackups, setShowCompletedBackups] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  // Load available tours
  useEffect(() => {
    if (isAuthenticated) {
      loadTours();
    }
  }, [isAuthenticated]);

  const checkAuthentication = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      console.log('User authenticated in component:', !!user);
    } catch (error) {
      console.error('Error checking authentication:', error);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

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

  const handleDeleteBackup = async (backupId: string, status: string) => {
    try {
      // Si está en progreso, cancelar primero
      if (status === 'processing' || status === 'pending') {
        await cancelBackup(backupId);
      }

      // Eliminar de la base de datos
      const { error } = await supabase
        .from('backup_jobs')
        .delete()
        .eq('id', backupId);

      if (error) throw error;

      // Remover de la lista local
      const updatedJobs = activeJobs.filter(job => job.backupId !== backupId);
      
      toast.success(t('backups.backupDeleted', { 
        defaultValue: 'Backup deleted successfully' 
      }));
      
      // Recargar la lista
      refreshJobs();
    } catch (error: any) {
      console.error('Error deleting backup:', error);
      toast.error(t('backups.errorDeletingBackup', { 
        defaultValue: 'Error deleting backup' 
      }));
    }
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

  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleDownloadSelected = async () => {
    if (selectedParts.size === 0) {
      toast.error('No files selected');
      return;
    }
    
    toast.info(`Starting download of ${selectedParts.size} file(s)...`);
    
    let totalDownloaded = 0;
    const completedBackups = activeJobs.filter(job => job.status === 'completed');
    
    for (const backup of completedBackups) {
      if (backup.isMultipart && backup.parts) {
        for (const part of backup.parts) {
          if (selectedParts.has(part.id) && part.file_url) {
            // Crear elemento <a> temporal para descargar sin ser bloqueado
            const link = document.createElement('a');
            link.href = part.file_url;
            link.download = `${backup.tourName}_part${part.part_number}.zip`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            totalDownloaded++;
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      } else {
        // Single file backup
        const partId = `${backup.backupId}_single`;
        if (selectedParts.has(partId) && backup.downloadUrl) {
          const link = document.createElement('a');
          link.href = backup.downloadUrl;
          link.download = `${backup.tourName}_backup.zip`;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          totalDownloaded++;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    toast.success(`Downloaded ${totalDownloaded} file(s)`);
    setSelectedParts(new Set());
  };

  const handleDownloadAsZip = async () => {
    if (selectedParts.size === 0) {
      toast.error('No files selected');
      return;
    }

    // Limit to 10 files to avoid edge function timeout
    if (selectedParts.size > 10) {
      toast.error('Cannot combine more than 10 files at once. Please use "Download Individual" for large backups.');
      return;
    }

    try {
      toast.info('Preparing combined download...');
      
      // Llamar al endpoint del backend que combine los archivos
      const { data, error } = await supabase.functions.invoke('combine-backup-files', {
        body: { 
          partIds: Array.from(selectedParts),
          backupIds: completedBackups.map(b => b.backupId)
        }
      });

      if (error) throw error;

      // Descargar el ZIP combinado
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = `combined_backup_${Date.now()}.zip`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success(`Combined ${data.filesIncluded} files into single ZIP!`);
        setSelectedParts(new Set());
      }
      
    } catch (error: any) {
      console.error('Error creating combined download:', error);
      toast.error('Failed to create combined download');
    }
  };

  const toggleBackupExpanded = (backupId: string) => {
    const newExpanded = new Set(expandedBackups);
    if (newExpanded.has(backupId)) {
      newExpanded.delete(backupId);
    } else {
      newExpanded.add(backupId);
    }
    setExpandedBackups(newExpanded);
  };

  const togglePartSelection = (partId: string) => {
    const newSelection = new Set(selectedParts);
    if (newSelection.has(partId)) {
      newSelection.delete(partId);
    } else {
      newSelection.add(partId);
    }
    setSelectedParts(newSelection);
  };

  const selectAllPartsInBackup = (backup: any) => {
    const newSelection = new Set(selectedParts);
    if (backup.isMultipart && backup.parts) {
      backup.parts.forEach((part: any) => {
        newSelection.add(part.id);
      });
    } else {
      newSelection.add(`${backup.backupId}_single`);
    }
    setSelectedParts(newSelection);
  };

  const deselectAllPartsInBackup = (backup: any) => {
    const newSelection = new Set(selectedParts);
    if (backup.isMultipart && backup.parts) {
      backup.parts.forEach((part: any) => {
        newSelection.delete(part.id);
      });
    } else {
      newSelection.delete(`${backup.backupId}_single`);
    }
    setSelectedParts(newSelection);
  };

  const areAllPartsSelected = (backup: any): boolean => {
    if (backup.isMultipart && backup.parts) {
      return backup.parts.every((part: any) => selectedParts.has(part.id));
    }
    return selectedParts.has(`${backup.backupId}_single`);
  };

  // Separate backups by status
  const activeBackups = activeJobs.filter(
    job => job.status === 'processing' || job.status === 'pending'
  );

  const completedBackups = activeJobs.filter(
    job => job.status === 'completed'
  );

  const failedBackups = activeJobs.filter(
    job => job.status === 'failed'
  );

  if (checkingAuth) {
    return (
      <div className="flex justify-center items-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Checking authentication...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {t('backups.authRequired', { defaultValue: 'Authentication Required' })}
            </h2>
            <p className="text-muted-foreground mb-4">
              {t('backups.authRequiredMessage', { 
                defaultValue: 'Please log in to access the backup system' 
              })}
            </p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('backups.refreshPage', { defaultValue: 'Refresh Page' })}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              // Solo considerar como activo si está realmente en progreso
              const hasActiveJob = activeJobs.some(
                job => job.tourId === tour.id && 
                (job.status === 'processing' || job.status === 'pending')
              );
              
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

      {/* Active Backups (Processing/Pending) */}
      {activeBackups.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('backups.activeBackups', { defaultValue: 'Active Backups' })} ({activeBackups.length})</CardTitle>
                <CardDescription>
                  {t('backups.trackBackupsDescription', { defaultValue: 'Currently processing or queued backups' })}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  toast.info('Processing backup queue...');
                  const result = await processQueue();
                  if (result) {
                    toast.success(`Processed ${result.processed} backups successfully`);
                    refreshJobs();
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('backups.processQueue', { defaultValue: 'Process Queue' })}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeBackups.map((job) => (
                <div key={job.backupId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{job.tourName}</span>
                        <Badge variant="secondary">
                          {getStatusText(job.status)}
                        </Badge>
                        <Badge variant="outline">
                          {job.jobType === 'full_backup' 
                            ? `💾 ${t('backups.complete', { defaultValue: 'Complete' })}` 
                            : `🖼️ ${t('backups.mediaOnly', { defaultValue: 'Media Only' })}`}
                        </Badge>
                      </div>
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
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(job.backupId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Backups (Collapsible with Multi-Select) */}
      {completedBackups.length > 0 && (
        <Card>
          <CardHeader 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setShowCompletedBackups(!showCompletedBackups)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {showCompletedBackups ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <div>
                  <CardTitle>
                    {t('backups.completedBackups', { defaultValue: 'Completed Backups' })} ({completedBackups.length})
                  </CardTitle>
                  {selectedParts.size > 0 && (
                    <CardDescription>
                      {selectedParts.size} {selectedParts.size === 1 ? 'file' : 'files'} selected
                    </CardDescription>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {selectedParts.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadSelected();
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Individual ({selectedParts.size})
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadAsZip();
                      }}
                      disabled={selectedParts.size > 10}
                      title={selectedParts.size > 10 ? 'Maximum 10 files can be combined. Use "Individual" for larger backups.' : ''}
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Single ZIP ({selectedParts.size})
                      {selectedParts.size > 10 && ' (Max 10)'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          
          {showCompletedBackups && (
            <CardContent>
              <div className="space-y-3">
                {completedBackups.map((backup) => {
                  const isExpanded = expandedBackups.has(backup.backupId);
                  const allSelected = areAllPartsSelected(backup);
                  const partsCount = backup.isMultipart ? backup.parts?.length || 0 : 1;
                  const totalSize = backup.isMultipart && backup.parts
                    ? backup.parts.reduce((sum, p) => sum + (p.file_size || 0), 0)
                    : backup.fileSize || 0;
                  
                  const timeAgo = getRelativeTime(backup.completedAt || backup.createdAt);
                  
                  return (
                    <div 
                      key={backup.backupId}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Backup Header */}
                      <div className="flex items-center gap-4 p-4 bg-card hover:bg-accent/20 transition-colors">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleBackupExpanded(backup.backupId)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{backup.tourName}</span>
                              <Badge variant="outline">
                                {backup.jobType === 'full_backup' ? '💾 Complete' : '🖼️ Media'}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>📦 {partsCount} {partsCount === 1 ? 'file' : 'files'}</span>
                              <span>💾 {formatFileSize(totalSize)}</span>
                              <span>🕐 {timeAgo}</span>
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (allSelected) {
                              deselectAllPartsInBackup(backup);
                            } else {
                              selectAllPartsInBackup(backup);
                            }
                          }}
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBackup(backup.backupId, backup.status);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Expandable Parts List */}
                      {isExpanded && (
                        <div className="border-t bg-muted/30">
                          {backup.isMultipart && backup.parts ? (
                            <div className="p-4 space-y-2">
                              {backup.parts.map((part) => {
                                const isPartSelected = selectedParts.has(part.id);
                                return (
                                  <div
                                    key={part.id}
                                    className={cn(
                                      "flex items-center gap-3 p-3 border rounded-md bg-background transition-all",
                                      isPartSelected && "border-primary bg-primary/5"
                                    )}
                                  >
                                    <Checkbox
                                      checked={isPartSelected}
                                      onCheckedChange={() => togglePartSelection(part.id)}
                                      className="h-4 w-4"
                                    />
                                    
                                    <div className="flex-1 flex items-center justify-between">
                                      <span className="text-sm font-medium">
                                        Part {part.part_number}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        {formatFileSize(part.file_size || 0)}
                                      </span>
                                    </div>
                                    
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        if (part.file_url) {
                                          window.open(part.file_url, '_blank');
                                          toast.success(`Downloading part ${part.part_number}`);
                                        }
                                      }}
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-4">
                              <div
                                className={cn(
                                  "flex items-center gap-3 p-3 border rounded-md bg-background transition-all",
                                  selectedParts.has(`${backup.backupId}_single`) && "border-primary bg-primary/5"
                                )}
                              >
                                <Checkbox
                                  checked={selectedParts.has(`${backup.backupId}_single`)}
                                  onCheckedChange={() => togglePartSelection(`${backup.backupId}_single`)}
                                  className="h-4 w-4"
                                />
                                
                                <div className="flex-1 flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    Backup File
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {formatFileSize(backup.fileSize || 0)}
                                  </span>
                                </div>
                                
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownload(backup)}
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Failed Backups */}
      {failedBackups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">
              {t('backups.failedBackups', { defaultValue: 'Failed Backups' })} ({failedBackups.length})
            </CardTitle>
            <CardDescription>
              {t('backups.failedBackupsDescription', { defaultValue: 'Backups that encountered errors' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {failedBackups.map((job) => (
                <div key={job.backupId} className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg bg-destructive/5">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{job.tourName}</span>
                        <Badge variant="destructive">
                          {getStatusText(job.status)}
                        </Badge>
                        <Badge variant="outline">
                          {job.jobType === 'full_backup' ? '💾 Complete' : '🖼️ Media'}
                        </Badge>
                      </div>
                    </div>
                    {job.error && (
                      <p className="text-sm text-destructive">{job.error}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBackup(job.backupId, job.status)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
