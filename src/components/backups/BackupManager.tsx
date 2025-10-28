import React, { useState, useEffect } from 'react';
import { useBackupSystem } from '@/hooks/useBackupSystem';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, X, RefreshCw, Archive, Image, MapPin, Camera, Target } from 'lucide-react';

// ============================================================
// TIPOS
// ============================================================

interface Tour {
  id: string;
  title: string;
  description: string | null;
  tenant_id: string;
  created_at: string;
  _counts?: {
    floor_plans: number;
    hotspots: number;
    panoramas: number;
  };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export const BackupManager: React.FC = () => {
  const { 
    activeJobs, 
    loading, 
    startBackup, 
    downloadBackup, 
    cancelBackup,
    refreshJobs,
  } = useBackupSystem();
  
  const [tours, setTours] = useState<Tour[]>([]);
  const [loadingTours, setLoadingTours] = useState(true);

  // ============================================================
  // CARGAR TOURS
  // ============================================================

  useEffect(() => {
    loadTours();
  }, []);

  const loadTours = async () => {
    try {
      setLoadingTours(true);

      // 1. Obtener tours del usuario actual
      const { data: toursData, error: toursError } = await supabase
        .from('virtual_tours')
        .select('id, title, description, tenant_id, created_at')
        .order('created_at', { ascending: false });

      if (toursError) {
        console.error('[BACKUP] Error cargando tours:', toursError);
        throw toursError;
      }

      if (!toursData || toursData.length === 0) {
        setTours([]);
        return;
      }

      // 2. Contar elementos para cada tour
      const toursWithCounts = await Promise.all(
        toursData.map(async (tour) => {
          // Contar floor plans
          const { count: floorPlansCount } = await supabase
            .from('floor_plans')
            .select('*', { count: 'exact', head: true })
            .eq('tour_id', tour.id);

          // Obtener floor plan IDs
          const { data: floorPlans } = await supabase
            .from('floor_plans')
            .select('id')
            .eq('tour_id', tour.id);
          
          const floorPlanIds = floorPlans?.map(fp => fp.id) || [];

          // Contar hotspots
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

          // Contar panoramas
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
      console.error('[BACKUP] Error cargando tours:', error);
      toast.error('Error al cargar tours');
    } finally {
      setLoadingTours(false);
    }
  };

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleStartBackup = async (tourId: string, backupType: 'full_backup' | 'media_only') => {
    const tour = tours.find(t => t.id === tourId);
    if (!tour) return;

    const backupId = await startBackup(tourId, backupType);
    if (backupId) {
      toast.success(`🚀 Backup de "${tour.title}" iniciado`);
    }
  };

  const handleDownload = (job: any) => {
    downloadBackup(job);
  };

  const handleCancel = (backupId: string) => {
    cancelBackup(backupId);
  };

  const handleRefresh = () => {
    loadTours();
    refreshJobs();
  };

  // ============================================================
  // HELPERS
  // ============================================================

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-blue-500 text-white';
      case 'completed': return 'bg-green-500 text-white';
      case 'failed': return 'bg-red-500 text-white';
      case 'cancelled': return 'bg-gray-500 text-white';
      default: return 'bg-yellow-500 text-white';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '⏳ Pendiente';
      case 'processing': return '⚙️ Procesando';
      case 'completed': return '✅ Completado';
      case 'failed': return '❌ Falló';
      case 'cancelled': return '🚫 Cancelado';
      default: return status;
    }
  };

  // ============================================================
  // RENDER - LOADING
  // ============================================================

  if (loadingTours) {
    return (
      <div className="flex justify-center items-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Cargando tours...</span>
      </div>
    );
  }

  // ============================================================
  // RENDER - MAIN
  // ============================================================

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sistema de Backup</h1>
          <p className="text-muted-foreground mt-2">
            Crea backups completos o solo de medios para tus tours virtuales
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loadingTours}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingTours ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Tours Disponibles */}
      <Card>
        <CardHeader>
          <CardTitle>Tours Disponibles</CardTitle>
          <CardDescription>
            Selecciona un tour para crear un backup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tours.map((tour) => {
              const counts = tour._counts || { floor_plans: 0, hotspots: 0, panoramas: 0 };
              const hasActiveJob = activeJobs.some(job => job.tourId === tour.id && job.status === 'processing');
              
              return (
                <Card key={tour.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg line-clamp-1">{tour.title}</h3>
                        {tour.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {tour.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge variant="secondary" className="gap-1">
                          <MapPin className="h-3 w-3" />
                          {counts.floor_plans} planos
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <Camera className="h-3 w-3" />
                          {counts.panoramas} fotos
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <Target className="h-3 w-3" />
                          {counts.hotspots} puntos
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleStartBackup(tour.id, 'full_backup')}
                          disabled={loading || hasActiveJob}
                          className="flex-1"
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Completo
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartBackup(tour.id, 'media_only')}
                          disabled={loading || hasActiveJob}
                          className="flex-1"
                        >
                          <Image className="h-4 w-4 mr-2" />
                          Medios
                        </Button>
                      </div>

                      {hasActiveJob && (
                        <Badge variant="default" className="w-full justify-center gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Backup en progreso
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {tours.length === 0 && (
            <div className="text-center py-12">
              <Archive className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg">No hay tours disponibles para backup</p>
              <p className="text-muted-foreground text-sm mt-2">Crea un tour primero para poder hacer backups</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backups Activos */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              Backups en Progreso
            </CardTitle>
            <CardDescription>
              Seguimiento en tiempo real de backups actualmente en procesamiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <div key={job.backupId} className="flex flex-col gap-3 p-4 border rounded-lg bg-card">
                  {/* Header del Job */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{job.tourName}</span>
                      <Badge className={getStatusColor(job.status)}>
                        {getStatusText(job.status)}
                      </Badge>
                      <Badge variant="outline">
                        {job.jobType === 'full_backup' ? '💾 Completo' : '🖼️ Solo Medios'}
                      </Badge>
                    </div>
                    
                    {job.fileSize && (
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(job.fileSize)}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {job.status === 'processing' && (
                    <div className="space-y-1">
                      <Progress value={job.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {job.processedItems} de {job.totalItems} elementos procesados
                        </span>
                        <span className="font-medium">{job.progress}%</span>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {job.error && (
                    <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                      ⚠️ {job.error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {job.status === 'completed' && job.downloadUrl && (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(job)}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Descargar Backup
                      </Button>
                    )}
                    
                    {job.status === 'processing' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancel(job.backupId)}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                    )}

                    {job.completedAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Completado: {new Date(job.completedAt).toLocaleString('es-ES')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información sobre tipos de backup */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Backup Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Backup Completo</h4>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Metadatos del tour (título, descripción)</li>
                <li>Todos los planos de piso</li>
                <li>Todos los hotspots y sus posiciones</li>
                <li>Todas las fotos 360° en alta calidad</li>
                <li>Estructura completa del tour</li>
              </ul>
              <p className="text-sm font-medium text-primary mt-2">
                ✅ Ideal para restauración completa
              </p>
            </div>
            
            <div className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Image className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold">Solo Medios</h4>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Fotos 360° organizadas por hotspot</li>
                <li>Planos de piso en carpeta separada</li>
                <li>Estructura de carpetas legible</li>
                <li>Sin metadatos ni configuraciones</li>
              </ul>
              <p className="text-sm font-medium text-green-600 mt-2">
                ✅ Ideal para archivo o migración de plataforma
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
