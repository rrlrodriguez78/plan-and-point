import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle } from 'lucide-react';

interface PlacementLoadingOverlayProps {
  isVisible: boolean;
  progress: number;
  currentPoint: number;
  totalPoints: number;
}

export const PlacementLoadingOverlay = ({
  isVisible,
  progress,
  currentPoint,
  totalPoints
}: PlacementLoadingOverlayProps) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg pointer-events-auto">
      <div className="bg-card border-2 border-primary p-8 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300">
        
        {/* Icono y título */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <h3 className="text-2xl font-bold">Procesando Punto...</h3>
        </div>

        {/* Barra de progreso grande */}
        <div className="space-y-2 mb-6">
          <Progress value={progress} className="h-4" />
          <div className="flex justify-between text-sm font-semibold text-primary">
            <span>Guardando datos</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Mensaje de advertencia */}
        <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning rounded-lg">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-warning mb-1">
              🚫 Espera para colocar el próximo punto
            </p>
            <p className="text-sm text-muted-foreground">
              Punto {currentPoint + 1} de {totalPoints} • El sistema está procesando...
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
