import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, Image, CheckCircle2, XCircle, Loader2, Calendar as CalendarIcon, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { matchPhotosToExistingHotspots, cleanupPreviews, type PhotoGroup, type HotspotPhotoMatch } from '@/utils/photoMatcher';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Hotspot } from '@/types/tour';
import { useAddPhotosToHotspot } from '@/hooks/useAddPhotosToHotspot';

interface PhotoGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingHotspots: Hotspot[];
  floorPlanId: string;
  tourId: string;
  onPhotosAdded: () => void;
}

export const PhotoGroupDialog = ({ 
  open, 
  onOpenChange, 
  existingHotspots,
  floorPlanId,
  tourId,
  onPhotosAdded 
}: PhotoGroupDialogProps) => {
  const { toast } = useToast();
  const { addPhotos, isAdding } = useAddPhotosToHotspot();
  
  const [photoGroups, setPhotoGroups] = useState<PhotoGroup[]>([
    { id: crypto.randomUUID(), name: 'Grupo 1', photos: [], manualDate: null }
  ]);
  const [matches, setMatches] = useState<HotspotPhotoMatch[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [validPhotos, setValidPhotos] = useState(0);
  const [ignoredPhotos, setIgnoredPhotos] = useState(0);

  useEffect(() => {
    if (!open) {
      // Cleanup previews manually
      if (matches.length > 0) {
        matches.forEach(match => {
          match.photos.forEach(photo => {
            if (photo.preview) {
              URL.revokeObjectURL(photo.preview);
            }
          });
        });
      }
      setPhotoGroups([{ id: crypto.randomUUID(), name: 'Grupo 1', photos: [], manualDate: null }]);
      setMatches([]);
      setValidPhotos(0);
      setIgnoredPhotos(0);
    }
  }, [open, matches]);

  const addPhotoGroup = () => {
    setPhotoGroups(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: `Grupo ${prev.length + 1}`, photos: [], manualDate: null }
    ]);
  };

  const removePhotoGroup = (id: string) => {
    if (photoGroups.length === 1) return;
    setPhotoGroups(prev => prev.filter(g => g.id !== id));
    setMatches([]);
  };

  const updateGroupName = (id: string, name: string) => {
    setPhotoGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
  };

  const updateGroupDate = (id: string, date: Date | undefined) => {
    setPhotoGroups(prev => prev.map(g => g.id === id ? { ...g, manualDate: date || null } : g));
  };

  const handleGroupFilesChange = (groupId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotoGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, photos: files } : g
    ));
    setMatches([]);
    
    if (files.length > 0) {
      const group = photoGroups.find(g => g.id === groupId);
      toast({
        title: `${group?.name} actualizado`,
        description: `${files.length} fotos cargadas`
      });
    }
  };

  const handleAnalyze = async () => {
    const totalPhotos = photoGroups.reduce((sum, g) => sum + g.photos.length, 0);
    if (totalPhotos === 0) {
      toast({
        title: "Faltan fotos",
        description: "Debes cargar fotos en al menos un grupo",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const results = await matchPhotosToExistingHotspots(existingHotspots, photoGroups);
      setMatches(results.matches);
      setValidPhotos(results.validPhotos);
      setIgnoredPhotos(results.ignoredPhotos);
      
      if (results.validPhotos === 0) {
        toast({
          title: "❌ Ninguna foto coincide",
          description: "Las fotos no coinciden con los puntos existentes",
          variant: "destructive"
        });
      } else if (results.ignoredPhotos > 0) {
        toast({
          title: "✅ Análisis completado",
          description: `${results.validPhotos} fotos válidas de ${totalPhotos} totales. ${results.ignoredPhotos} fotos ignoradas (nombre no coincide)`
        });
      } else {
        toast({
          title: "✅ Todas las fotos coinciden",
          description: `${results.validPhotos} fotos válidas para ${results.matches.filter(m => m.status === 'matched').length} puntos`
        });
      }
    } catch (error) {
      toast({
        title: "Error en análisis",
        description: "No se pudo realizar el matching",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddPhotos = async () => {
    const validMatches = matches.filter(m => m.status === 'matched');
    
    if (validMatches.length === 0) {
      toast({
        title: "No hay fotos válidas",
        description: "No se encontraron matches entre fotos y puntos",
        variant: "destructive"
      });
      return;
    }

    try {
      let totalAdded = 0;
      
      for (const match of validMatches) {
        await addPhotos({
          hotspotId: match.hotspot.id,
          photos: match.photos.map(p => ({
            file: p.file,
            captureDate: p.captureDate,
            groupName: p.groupName
          })),
          tourId,
          floorPlanId,
          hotspotTitle: match.hotspot.title
        });
        
        totalAdded += match.photos.length;
      }
      
      toast({
        title: "✅ Fotos agregadas exitosamente",
        description: `${totalAdded} fotos agregadas a ${validMatches.length} punto(s)`
      });
      
      onPhotosAdded();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error agregando fotos",
        description: "No se pudieron agregar todas las fotos",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    // Cleanup previews manually
    if (matches.length > 0) {
      matches.forEach(match => {
        match.photos.forEach(photo => {
          if (photo.preview) {
            URL.revokeObjectURL(photo.preview);
          }
        });
      });
    }
    
    setPhotoGroups([{ id: crypto.randomUUID(), name: 'Grupo 1', photos: [], manualDate: null }]);
    setMatches([]);
    setValidPhotos(0);
    setIgnoredPhotos(0);
    
    onOpenChange(false);
  };

  const matchedHotspots = matches.filter(m => m.status === 'matched').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Agregar Fotos por Grupo a Puntos Existentes</DialogTitle>
          <DialogDescription>
            Organiza tus fotos en grupos por fecha. Solo se agregarán fotos cuyos nombres coincidan con puntos ya creados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Alerta IMPORTANTE en rojo */}
          <Alert variant="destructive" className="border-2 border-red-600 bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <AlertTitle className="text-red-800 dark:text-red-400 font-bold text-base">
              ⚠️ IMPORTANTE: Solo se agregarán fotos con nombres coincidentes
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-300 space-y-2 text-sm">
              <p>Las fotos deben tener nombres que coincidan <strong>EXACTAMENTE</strong> con los puntos ya creados en el plano.</p>
              
              <div className="mt-2">
                <p className="font-semibold">✅ Ejemplos válidos:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Punto: "B-0-0" → Fotos: "B-0-0.jpg", "B-0-0-2024-10-15.jpg"</li>
                  <li>Punto: "Cocina" → Fotos: "Cocina.jpg", "Cocina-vista1.jpg"</li>
                </ul>
              </div>
              
              <p className="font-semibold mt-2">❌ Fotos con nombres diferentes serán IGNORADAS automáticamente</p>
              
              <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-300 dark:border-blue-700">
                <p className="font-semibold text-blue-800 dark:text-blue-300">💡 Si deseas agregar fotos con nombres diferentes:</p>
                <ol className="list-decimal list-inside ml-2 space-y-1 text-blue-700 dark:text-blue-400">
                  <li>Entra al punto específico en el plano</li>
                  <li>Abre el editor del punto</li>
                  <li>Agrega las fotos directamente</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>

          {/* Alerta informativa */}
          {existingHotspots.length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No hay puntos en este plano</AlertTitle>
              <AlertDescription>
                Debes crear puntos primero usando el botón "Auto avance" o "Add Point"
              </AlertDescription>
            </Alert>
          )}

          {existingHotspots.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Puntos disponibles: {existingHotspots.length}</AlertTitle>
              <AlertDescription>
                Las fotos deben tener nombres que coincidan con estos puntos: {existingHotspots.slice(0, 5).map(h => h.title).join(', ')}
                {existingHotspots.length > 5 && ` y ${existingHotspots.length - 5} más...`}
              </AlertDescription>
            </Alert>
          )}

          {/* Sección grupos de fotos */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold">Grupos de fotos</h3>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addPhotoGroup}
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar grupo
              </Button>
            </div>

            <div className="space-y-3">
              {photoGroups.map((group, idx) => (
                <Card key={group.id} className="p-3 border-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Badge variant="secondary">#{idx + 1}</Badge>
                      <Input
                        value={group.name}
                        onChange={(e) => updateGroupName(group.id, e.target.value)}
                        className="h-8"
                        placeholder="Nombre del grupo"
                      />
                    </div>
                    {photoGroups.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removePhotoGroup(group.id)}
                        className="h-8 w-8 ml-2"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      id={`file-${group.id}`}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.JPG,.JPEG"
                      className="hidden"
                      onChange={(e) => handleGroupFilesChange(group.id, e)}
                    />
                    
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => document.getElementById(`file-${group.id}`)?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {group.photos.length === 0
                        ? "Seleccionar fotos JPG"
                        : `✓ ${group.photos.length} fotos cargadas`}
                    </Button>

                    {group.photos.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Fecha de captura (opcional si las fotos tienen fecha en nombre)
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full justify-start h-9 text-sm"
                            >
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {group.manualDate
                                ? format(group.manualDate, "PPP", { locale: es })
                                : "Detectar del nombre o seleccionar"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={group.manualDate || undefined}
                              onSelect={(date) => updateGroupDate(group.id, date)}
                              disabled={(date) => date > new Date()}
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Botón analizar */}
          {photoGroups.some(g => g.photos.length > 0) && matches.length === 0 && existingHotspots.length > 0 && (
            <Button 
              className="w-full" 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analizando...
                </>
              ) : (
                'Analizar Matches'
              )}
            </Button>
          )}

          {/* Preview de matches */}
          {matches.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3 p-3 bg-primary/5 rounded-lg">
                <div>
                  <h3 className="font-semibold">
                    {validPhotos > 0 ? '✅ Análisis completado' : '⚠️ Sin coincidencias'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {matchedHotspots} punto(s) con fotos válidas
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{validPhotos}</p>
                  <p className="text-xs text-muted-foreground">fotos válidas</p>
                  {ignoredPhotos > 0 && (
                    <p className="text-xs text-destructive">{ignoredPhotos} ignoradas</p>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {matches.map((match, idx) => (
                    <Card
                      key={idx}
                      className={cn(
                        "p-3",
                        match.status === 'no-match' && "border-muted bg-muted/20"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                            <h4 className="font-semibold font-mono text-sm">{match.hotspot.title}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {match.photos.length} foto(s) encontrada(s)
                          </p>
                        </div>
                        {match.status === 'matched' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>

                      {match.photos.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {match.photos.map((photo, pIdx) => (
                            <div
                              key={pIdx}
                              className="flex items-center gap-2 p-2 bg-card rounded border"
                            >
                              <img
                                src={photo.preview}
                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                                alt=""
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {photo.groupName}
                                </p>
                                {photo.captureDate ? (
                                  <p className="text-xs text-primary">
                                    📅 {format(parseISO(photo.captureDate), "dd/MM/yyyy")}
                                  </p>
                                ) : (
                                  <p className="text-xs text-yellow-600">
                                    ⚠️ Sin fecha
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>
            Cancelar
          </Button>
          {matches.length > 0 && validPhotos > 0 && (
            <Button onClick={handleAddPhotos} disabled={isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Agregando...
                </>
              ) : (
                `Agregar Fotos a Puntos (${validPhotos})`
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};