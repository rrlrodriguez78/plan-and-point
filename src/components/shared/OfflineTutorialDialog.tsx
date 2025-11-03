import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Wifi, Camera, RefreshCw, CheckCircle2, ChevronRight, ChevronLeft, X } from 'lucide-react';

interface OfflineTutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  {
    icon: Download,
    title: '1. Preparar tours offline',
    description: 'En el Editor, busca el botón "Preparar offline" en la barra superior',
    details: [
      'Necesitas conexión a internet para este paso',
      'El sistema descargará todas las fotos e imágenes del tour',
      'Las imágenes se comprimen automáticamente para ahorrar espacio',
      'Puedes preparar hasta 5 tours simultáneamente'
    ],
    tip: '💡 Prepara los tours antes de ir al campo para trabajar sin internet'
  },
  {
    icon: Wifi,
    title: '2. Verificar preparación',
    description: 'Ve al menú "Caché Offline" para ver los tours descargados',
    details: [
      'Verás el tamaño de cada tour en caché',
      'Puedes actualizar un tour si hubo cambios',
      'Los tours expiran después de 7 días',
      'Límite total de caché: 100MB'
    ],
    tip: '✅ Un tour preparado tiene el icono de descarga verde'
  },
  {
    icon: Camera,
    title: '3. Capturar fotos sin internet',
    description: 'Conéctate al WiFi de tu Theta Z1 (THETAXXXXX.OSC)',
    details: [
      'Enciende tu cámara Theta Z1',
      'Conecta tu celular al WiFi de la cámara',
      'En la app, ve a "Captura Offline con Theta"',
      'Las fotos se guardan localmente en tu dispositivo'
    ],
    tip: '📸 Puedes capturar ilimitadas fotos sin conexión a internet'
  },
  {
    icon: RefreshCw,
    title: '4. Sincronización automática',
    description: 'Al reconectar a internet, todo se sincroniza automáticamente',
    details: [
      'El sistema detecta cuando tienes internet',
      'Las fotos pendientes se suben a la nube',
      'Los tours se actualizan con las nuevas fotos',
      'Verás el progreso en tiempo real'
    ],
    tip: '🔄 La sincronización es automática, no necesitas hacer nada'
  },
];

export function OfflineTutorialDialog({ open, onOpenChange }: OfflineTutorialDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('offline_tutorial_completed', 'true');
    onOpenChange(false);
    setCurrentStep(0);
  };

  const step = steps[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Tutorial: Trabajo Offline
            </DialogTitle>
            <Badge variant="secondary">
              Paso {currentStep + 1} de {steps.length}
            </Badge>
          </div>
          <DialogDescription>
            Aprende a trabajar sin conexión a internet con Virtual Tour 360
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              {steps.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`hover:text-foreground transition-colors ${
                    idx === currentStep ? 'text-primary font-medium' : ''
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Step content */}
          <div className="rounded-lg border bg-muted/30 p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>

            <div className="space-y-2 pl-16">
              {step.details.map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>

            <div className="pl-16 pt-2">
              <div className="rounded-lg bg-primary/10 px-4 py-3 border border-primary/20">
                <p className="text-sm font-medium text-primary">{step.tip}</p>
              </div>
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            <Button
              variant="ghost"
              onClick={handleComplete}
              className="text-muted-foreground"
            >
              Saltar tutorial
            </Button>

            {currentStep === steps.length - 1 ? (
              <Button onClick={handleComplete}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Finalizar
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Siguiente
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
