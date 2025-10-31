import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, X } from 'lucide-react';

interface AutoUpdateBannerProps {
  countdown: number;
  autoUpdateDelay: number;
  onUpdate: () => void;
  onCancel: () => void;
}

export function AutoUpdateBanner({ 
  countdown, 
  autoUpdateDelay,
  onUpdate, 
  onCancel 
}: AutoUpdateBannerProps) {
  const countdownSeconds = Math.ceil(countdown / 1000);
  const progress = ((autoUpdateDelay - countdown) / autoUpdateDelay) * 100;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-primary/90 backdrop-blur-sm border-b-4 border-primary shadow-2xl animate-in slide-in-from-top duration-500">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {/* Mensaje principal */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 text-primary-foreground animate-spin" />
              <div>
                <p className="text-lg font-semibold text-primary-foreground">
                  ¡Nueva versión disponible!
                </p>
                <p className="text-sm text-primary-foreground/90">
                  Actualizando automáticamente en {countdownSeconds} segundos
                </p>
              </div>
            </div>
            
            {/* Botones */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={onCancel}
                className="bg-background/90 hover:bg-background"
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button 
                variant="secondary" 
                onClick={onUpdate}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Actualizar ahora
              </Button>
            </div>
          </div>
          
          {/* Progress bar */}
          <Progress value={progress} className="h-2 bg-primary-foreground/20" />
        </div>
      </div>
    </div>
  );
}
