import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{
    synced: number;
    failed: number;
    total: number;
    alreadySynced: number;
  } | null>(null);
  const [errors, setErrors] = useState<Array<{ photoId: string; error: string }>>([]);

  React.useEffect(() => {
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
            disabled={loading || syncing}
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
          onClick={handleSync}
          disabled={!selectedTourId || syncing}
          className="w-full"
        >
          {syncing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Iniciar Sincronización
            </>
          )}
        </Button>

        {progress && (
          <div className="space-y-3 pt-4 border-t">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Progreso</span>
                <span className="text-muted-foreground">
                  {progress.synced + progress.failed} / {progress.total} fotos
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  <div className="font-semibold">{progress.synced}</div>
                  <div className="text-xs">Sincronizadas</div>
                </AlertDescription>
              </Alert>

              {progress.alreadySynced > 0 && (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-400">
                    <div className="font-semibold">{progress.alreadySynced}</div>
                    <div className="text-xs">Ya existían</div>
                  </AlertDescription>
                </Alert>
              )}

              {progress.failed > 0 && (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700 dark:text-red-400">
                    <div className="font-semibold">{progress.failed}</div>
                    <div className="text-xs">Fallidas</div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
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
      </CardContent>
    </Card>
  );
};
