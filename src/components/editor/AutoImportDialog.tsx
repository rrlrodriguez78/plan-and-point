import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, Image, CheckCircle2, XCircle, Loader2, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { parseListFile, validateNames } from '@/utils/listParser';
import { matchPhotosToNames, cleanupPreviews, type Match } from '@/utils/photoMatcher';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AutoImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartPlacement: (matches: Match[]) => void;
}

export const AutoImportDialog = ({ open, onOpenChange, onStartPlacement }: AutoImportDialogProps) => {
  const { toast } = useToast();
  const [listFile, setListFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [placementMethod, setPlacementMethod] = useState<'manual' | 'auto'>('manual');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [manualDate, setManualDate] = useState<Date | undefined>(undefined);
  
  const listInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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
      setMatches([]); // Reset matches cuando cambia el archivo
      
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

  const handlePhotoFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotoFiles(files);
    setMatches([]); // Reset matches cuando cambian las fotos
    
    if (files.length > 0) {
      toast({
        title: "Fotos cargadas",
        description: `${files.length} archivos seleccionados`
      });
    }
  };

  const handleAnalyze = async () => {
    if (names.length === 0 || photoFiles.length === 0) {
      toast({
        title: "Faltan archivos",
        description: "Debes cargar tanto list.txt como las fotos",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const matchedResults = await matchPhotosToNames(names, photoFiles);
      setMatches(matchedResults);
      
      const matched = matchedResults.filter(m => m.status === 'matched').length;
      const missing = matchedResults.filter(m => m.status === 'missing').length;
      
      toast({
        title: "Análisis completado",
        description: `✅ ${matched} matches exitosos${missing > 0 ? ` | ❌ ${missing} sin foto` : ''}`
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
    const validMatches = matches.filter(m => m.status === 'matched');
    
    if (validMatches.length === 0) {
      toast({
        title: "No hay puntos válidos",
        description: "No se encontraron matches entre nombres y fotos",
        variant: "destructive"
      });
      return;
    }

    // Aplicar fecha manual a matches sin fecha
    const matchesWithDates = validMatches.map(m => ({
      ...m,
      captureDate: m.captureDate || (manualDate ? format(manualDate, 'yyyy-MM-dd') : null)
    }));

    onStartPlacement(matchesWithDates);
  };

  const handleClose = () => {
    // Cleanup previews
    if (matches.length > 0) {
      cleanupPreviews(matches);
    }
    
    // Reset state
    setListFile(null);
    setPhotoFiles([]);
    setNames([]);
    setMatches([]);
    setPlacementMethod('manual');
    
    onOpenChange(false);
  };

  const matchedCount = matches.filter(m => m.status === 'matched').length;
  const missingCount = matches.filter(m => m.status === 'missing').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importación Automática de Puntos</DialogTitle>
          <DialogDescription>
            Carga tu archivo list.txt y las fotos panorámicas para crear puntos automáticamente
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
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

          {/* Sección fotos */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Image className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold">Fotos panorámicas</h3>
            </div>
            
            <input
              ref={photoInputRef}
              type="file"
              accept=".jpg,.jpeg,.JPG,.JPEG"
              multiple
              onChange={handlePhotoFilesChange}
              className="hidden"
            />
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => photoInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {photoFiles.length > 0 ? `✓ ${photoFiles.length} fotos seleccionadas` : 'Seleccionar fotos JPG'}
            </Button>
          </Card>

          {/* Botón analizar */}
          {names.length > 0 && photoFiles.length > 0 && matches.length === 0 && (
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Resultados del matching</h3>
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    {matchedCount} matches
                  </span>
                  {missingCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="w-4 h-4" />
                      {missingCount} sin foto
                    </span>
                  )}
                </div>
              </div>

              {/* Alerta de fotos sin fecha */}
              {matches.some(m => m.photo && m.captureDate === null) && (
                <Alert className="mb-4 border-yellow-500 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-900">Fecha no detectada</AlertTitle>
                  <AlertDescription className="text-yellow-800">
                    {matches.filter(m => m.photo && m.captureDate === null).length} fotos no tienen fecha en su nombre.
                    Selecciona una fecha de captura para estas fotos:
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full mt-2 justify-start text-left font-normal",
                            !manualDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {manualDate ? format(manualDate, "PPP", { locale: es }) : "Selecciona fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={manualDate}
                          onSelect={setManualDate}
                          disabled={(date) => date > new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-48 border rounded-lg">
                <div className="p-2 space-y-1">
                  {matches.map((match, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                    >
                      <span className="text-xs text-muted-foreground w-8">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm">{match.name}</div>
                        {match.photo && match.captureDate && (
                          <div className="flex items-center gap-1 text-xs text-blue-600 mt-0.5">
                            <CalendarIcon className="w-3 h-3" />
                            {format(parseISO(match.captureDate), "dd/MM/yyyy")}
                          </div>
                        )}
                        {match.photo && !match.captureDate && (
                          <div className="text-xs text-yellow-600 mt-0.5">⚠️ Sin fecha</div>
                        )}
                      </div>
                      {match.status === 'matched' ? (
                        <>
                          {match.photoPreview && (
                            <img 
                              src={match.photoPreview} 
                              alt={match.name}
                              className="w-10 h-10 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-destructive">Sin foto</span>
                          <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                        </>
                      )}
                    </div>
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
                        Haz click en el plano {matchedCount} veces para colocar cada punto en orden
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 opacity-50 cursor-not-allowed">
                    <RadioGroupItem value="auto" id="auto" disabled />
                    <Label htmlFor="auto" className="flex-1">
                      <div className="font-medium">Distribución automática en grid</div>
                      <div className="text-xs text-muted-foreground">
                        (Próximamente)
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
            disabled={matchedCount === 0}
          >
            Comenzar Colocación ({matchedCount} puntos)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
