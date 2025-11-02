import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Map, Upload } from "lucide-react";

interface Tour {
  id: string;
  title: string;
  tenant_id: string;
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

  const handleSync = async () => {
    if (!selectedTourId) {
      toast.error('Selecciona un tour');
      return;
    }

    setSyncing(true);
    setProgress(null);
    setErrors([]);

    try {
      const { data, error } = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (error) throw error;

      if (data.success) {
        setProgress({
          synced: data.synced,
          failed: data.failed,
          total: data.total,
          alreadySynced: data.alreadySynced || 0
        });
        setErrors(data.errors || []);

        if (data.failed === 0) {
          toast.success(`✅ ${data.synced} fotos sincronizadas exitosamente`);
        } else {
          toast.warning(`⚠️ ${data.synced} sincronizadas, ${data.failed} fallidas`);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
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

  const progressPercent = progress 
    ? ((progress.synced + progress.failed) / progress.total) * 100 
    : 0;

  return (
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
            disabled={loading || syncing || syncingFloorPlans}
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

        <div className="grid grid-cols-2 gap-2">
          <Button 
            onClick={handleSync}
            disabled={!selectedTourId || syncing || syncingFloorPlans}
          >
            {syncing ? "Sincronizando..." : "Sincronizar Fotos"}
          </Button>
          
          <Button 
            onClick={handleSyncFloorPlans}
            disabled={!selectedTourId || syncing || syncingFloorPlans}
            variant="outline"
          >
            <Map className="h-4 w-4 mr-2" />
            {syncingFloorPlans ? "Sincronizando..." : "Sincronizar Planos"}
          </Button>
        </div>

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
  );
};
