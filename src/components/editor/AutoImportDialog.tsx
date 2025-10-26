import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Image, CheckCircle2, XCircle, Loader2, Calendar as CalendarIcon, AlertCircle, Plus, Trash2, ChevronDown } from 'lucide-react';
import { parseListFile, validateNames } from '@/utils/listParser';
import { matchPhotosToNames, cleanupPreviews, type Match, type PhotoGroup } from '@/utils/photoMatcher';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, parseISO } from 'date-fns';
import { es, enUS, fr, de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AutoImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartPlacement: (matches: Match[]) => void;
}

export const AutoImportDialog = ({ open, onOpenChange, onStartPlacement }: AutoImportDialogProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [listFile, setListFile] = useState<File | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [photoGroups, setPhotoGroups] = useState<PhotoGroup[]>([
    { id: crypto.randomUUID(), name: `${t('autoImport.groupName')} 1`, photos: [], manualDate: null }
  ]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [placementMethod, setPlacementMethod] = useState<'manual' | 'auto'>('manual');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasStartedPlacement, setHasStartedPlacement] = useState(false);
  
  const listInputRef = useRef<HTMLInputElement>(null);

  // Limpiar automáticamente cuando el diálogo se cierra después de completar la colocación
  useEffect(() => {
    if (!open && hasStartedPlacement) {
      cleanupPreviews(matches);
      setListFile(null);
      setPhotoGroups([{ id: crypto.randomUUID(), name: 'Grupo 1', photos: [], manualDate: null }]);
      setNames([]);
      setMatches([]);
      setPlacementMethod('manual');
      setHasStartedPlacement(false);
    }
  }, [open, hasStartedPlacement, matches]);

  const handleListFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedNames = await parseListFile(file);
      const validation = validateNames(parsedNames);
      
      if (!validation.valid) {
        toast({
          title: "Error en list.txt",
          description: validation.errors.join('\n'),
          variant: "destructive"
        });
        return;
      }

      setListFile(file);
      setNames(parsedNames);
      setMatches([]);
      
      toast({
        title: "Archivo cargado",
        description: `${parsedNames.length} nombres encontrados`
      });
    } catch (error) {
      toast({
        title: "Error leyendo archivo",
        description: "No se pudo leer el archivo list.txt",
        variant: "destructive"
      });
    }
  };

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
    if (names.length === 0) {
      toast({
        title: "Falta list.txt",
        description: "Debes cargar el archivo list.txt primero",
        variant: "destructive"
      });
      return;
    }

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
      const matchedResults = await matchPhotosToNames(names, [], photoGroups);
      setMatches(matchedResults);
      
      const totalMatches = matchedResults.reduce((sum, m) => sum + m.photos.length, 0);
      const pointsWithPhotos = matchedResults.filter(m => m.photos.length > 0).length;
      const pointsWithoutPhotos = matchedResults.filter(m => m.photos.length === 0).length;
      
      toast({
        title: "✅ Análisis completado",
        description: `${pointsWithPhotos} puntos con fotos (${totalMatches} fotos totales)${pointsWithoutPhotos > 0 ? ` | ❌ ${pointsWithoutPhotos} sin foto` : ''}`
      });
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

  const handleStart = () => {
    const validMatches = matches.filter(m => m.photos.length > 0);
    
    if (validMatches.length === 0) {
      toast({
        title: "No hay puntos válidos",
        description: "No se encontraron matches entre nombres y fotos",
        variant: "destructive"
      });
      return;
    }

    setHasStartedPlacement(true);
    onStartPlacement(validMatches);
  };

  const handleClose = () => {
    if (matches.length > 0) {
      cleanupPreviews(matches);
    }
    
    setListFile(null);
    setPhotoGroups([{ id: crypto.randomUUID(), name: 'Grupo 1', photos: [], manualDate: null }]);
    setNames([]);
    setMatches([]);
    setPlacementMethod('manual');
    
    onOpenChange(false);
  };

  const pointsWithPhotos = matches.filter(m => m.photos.length > 0).length;
  const totalPhotos = matches.reduce((sum, m) => sum + m.photos.length, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importación Automática de Puntos</DialogTitle>
          <DialogDescription>
            Carga tu archivo list.txt y organiza tus fotos en grupos por fecha
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Ayuda colapsable */}
          <Collapsible>
            <Card className="border-2 border-red-600 bg-red-50 dark:bg-red-950/20">
              <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-red-800 dark:text-red-400 font-semibold text-sm">
                    ⚠️ IMPORTANTE: Reglas de coincidencia de nombres
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-red-600 transition-transform duration-200" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <div className="text-red-700 dark:text-red-300 space-y-2 text-xs mt-2">
                  <p>Este método requiere que los nombres en <strong>list.txt</strong> y las <strong>fotos</strong> coincidan para máxima rapidez.</p>
                  <div className="mt-1">
                    <p className="font-semibold">✅ Ejemplos correctos:</p>
                    <ul className="list-disc list-inside ml-1 space-y-0.5">
                      <li>list.txt: "B-0-0" → "B-0-0.jpg", "B-0-0-2024.jpg"</li>
                      <li>list.txt: "Sala" → "Sala.jpg", "Sala-vista.jpg"</li>
                    </ul>
                  </div>
                  <div className="mt-1 p-2 bg-amber-100 dark:bg-amber-900/30 rounded border border-amber-300 dark:border-amber-700">
                    <p className="font-semibold text-amber-800 dark:text-amber-300">📋 Formato list.txt:</p>
                    <pre className="mt-0.5 p-1.5 bg-white dark:bg-gray-800 rounded text-xs font-mono">B-0-0{'\n'}Sala{'\n'}Cocina</pre>
                  </div>
                  <div className="mt-1 p-2 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-300 dark:border-blue-700">
                    <p className="font-semibold text-blue-800 dark:text-blue-300">💡 Sin restricciones:</p>
                    <p className="text-blue-700 dark:text-blue-400">Usa <strong>"Add Point"</strong> para colocar puntos manualmente</p>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Sección list.txt */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold">Archivo list.txt</h3>
            </div>
            
            <input
              ref={listInputRef}
              type="file"
              accept=".txt"
              onChange={handleListFileChange}
              className="hidden"
            />
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => listInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {listFile ? `✓ ${listFile.name} (${names.length} líneas)` : 'Seleccionar list.txt'}
            </Button>
          </Card>

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
          {names.length > 0 && photoGroups.some(g => g.photos.length > 0) && matches.length === 0 && (
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
                  <h3 className="font-semibold">✅ Análisis completado</h3>
                  <p className="text-sm text-muted-foreground">
                    {pointsWithPhotos} puntos con fotos
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{totalPhotos}</p>
                  <p className="text-xs text-muted-foreground">fotos totales</p>
                </div>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {matches.map((match, idx) => (
                    <Card
                      key={idx}
                      className={cn(
                        "p-3",
                        match.photos.length === 0 && "border-destructive/50 bg-destructive/5"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                            <h4 className="font-semibold font-mono text-sm">{match.name}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {match.photos.length} foto(s) encontrada(s)
                          </p>
                        </div>
                        {match.photos.length > 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
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

              {/* Método de colocación */}
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-semibold mb-3">Método de colocación</h4>
                <RadioGroup value={placementMethod} onValueChange={(v: any) => setPlacementMethod(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="manual" id="manual" />
                    <Label htmlFor="manual" className="flex-1 cursor-pointer">
                      <div className="font-medium">Colocación manual guiada</div>
                      <div className="text-xs text-muted-foreground">
                        Haz click en el plano {pointsWithPhotos} veces para colocar cada punto
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleStart}
            disabled={pointsWithPhotos === 0}
          >
            Comenzar Colocación ({pointsWithPhotos} puntos, {totalPhotos} fotos)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};