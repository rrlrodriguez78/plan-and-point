import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useStructuredExport } from '@/hooks/useStructuredExport';
import { Info, Download, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
}

export function StructuredExportDialog({ open, onOpenChange, tourId, tourName }: Props) {
  const { 
    estimating, 
    exporting, 
    exportJobs, 
    estimateExport, 
    exportFloorPlans,
    downloadExport,
    downloadAllExports 
  } = useStructuredExport();

  const [floorPlans, setFloorPlans] = useState<any[]>([]);
  const [selectedFloors, setSelectedFloors] = useState<Set<string>>(new Set());
  const [downloadMode, setDownloadMode] = useState<'auto' | 'manual'>('manual');
  const [step, setStep] = useState<'select' | 'exporting' | 'completed'>('select');

  useEffect(() => {
    if (open && tourId) {
      loadFloorPlans();
      setStep('select');
    }
  }, [open, tourId]);

  useEffect(() => {
    if (exportJobs.length > 0) {
      const allCompleted = exportJobs.every(job => 
        job.status === 'completed' || job.status === 'failed'
      );
      
      if (allCompleted && step === 'exporting') {
        setStep('completed');
      }
    }
  }, [exportJobs, step]);

  const loadFloorPlans = async () => {
    const floors = await estimateExport(tourId);
    setFloorPlans(floors);
    setSelectedFloors(new Set(floors.map(f => f.floor_plan_id)));
  };

  const toggleFloor = (floorId: string) => {
    const newSelected = new Set(selectedFloors);
    if (newSelected.has(floorId)) {
      newSelected.delete(floorId);
    } else {
      newSelected.add(floorId);
    }
    setSelectedFloors(newSelected);
  };

  const handleExport = async () => {
    setStep('exporting');
    await exportFloorPlans(tourId, Array.from(selectedFloors), downloadMode);
  };

  const totalSize = floorPlans
    .filter(f => selectedFloors.has(f.floor_plan_id))
    .reduce((sum, f) => sum + f.estimated_size_mb, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar Tour: {tourName}</DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecciona los planos a exportar. Cada plano generará un archivo ZIP independiente.
              </p>

              {estimating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Calculando tamaños...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {floorPlans.map(floor => (
                    <div key={floor.floor_plan_id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Checkbox
                        checked={selectedFloors.has(floor.floor_plan_id)}
                        onCheckedChange={() => toggleFloor(floor.floor_plan_id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{floor.floor_name}</div>
                        <div className="text-sm text-muted-foreground">
                          • {floor.hotspot_count} hotspots
                        </div>
                        <div className="text-sm text-muted-foreground">
                          • {floor.photo_count} fotos 360°
                        </div>
                        <div className="text-sm text-muted-foreground">
                          • Tamaño estimado: {floor.estimated_size_mb.toFixed(0)} MB
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>TOTAL:</strong> {selectedFloors.size} archivo(s) ZIP / {(totalSize / 1024).toFixed(2)} GB
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Opciones de descarga:</Label>
                <RadioGroup value={downloadMode} onValueChange={(v) => setDownloadMode(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="auto" id="auto" />
                    <Label htmlFor="auto">Descargar todos automáticamente</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="manual" id="manual" />
                    <Label htmlFor="manual">Permitirme elegir uno por uno</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleExport} 
                disabled={selectedFloors.size === 0 || exporting}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Iniciar Exportación
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'exporting' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exportando archivos ZIP...
            </p>
            {exportJobs.map(job => (
              <div key={job.export_token} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{job.floor_name}</span>
                  <span className="text-sm text-muted-foreground">{job.progress}%</span>
                </div>
                <Progress value={job.progress} />
              </div>
            ))}
          </div>
        )}

        {step === 'completed' && (
          <>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Exportación completada. {downloadMode === 'manual' ? 'Selecciona los archivos a descargar:' : 'Descargando automáticamente...'}
              </p>

              {exportJobs.map(job => (
                <div key={job.export_token} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{job.floor_name}</div>
                    {job.status === 'completed' && (
                      <div className="text-sm text-green-600">✅ Listo para descargar</div>
                    )}
                    {job.status === 'failed' && (
                      <div className="text-sm text-destructive">❌ {job.error_message}</div>
                    )}
                  </div>
                  {job.status === 'completed' && downloadMode === 'manual' && (
                    <Button size="sm" onClick={() => downloadExport(job.export_token)}>
                      <Download className="h-4 w-4 mr-2" />
                      Descargar
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              {downloadMode === 'manual' && exportJobs.some(j => j.status === 'completed') && (
                <Button onClick={downloadAllExports}>
                  Descargar Todos
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
