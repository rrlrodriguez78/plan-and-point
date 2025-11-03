import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, HelpCircle, X } from 'lucide-react';
import { tourOfflineCache } from '@/utils/tourOfflineCache';

interface OfflineQuickStartProps {
  onOpenTutorial: () => void;
}

export function OfflineQuickStart({ onOpenTutorial }: OfflineQuickStartProps) {
  const [dismissed, setDismissed] = useState(false);
  const [hasCachedTours, setHasCachedTours] = useState(false);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const cachedTours = await tourOfflineCache.getAllCachedTours();
      setHasCachedTours(cachedTours.length > 0);
      setHasSeenTutorial(localStorage.getItem('offline_tutorial_completed') === 'true');
      setDismissed(localStorage.getItem('offline_quickstart_dismissed') === 'true');
    };
    checkStatus();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('offline_quickstart_dismissed', 'true');
  };

  // Don't show if dismissed, has cached tours, or has seen tutorial
  if (dismissed || hasCachedTours || hasSeenTutorial) {
    return null;
  }

  const checklist = [
    { id: 'prepare', label: 'Preparar un tour offline', completed: hasCachedTours },
    { id: 'verify', label: 'Verificar en Gestión de Caché', completed: hasCachedTours },
    { id: 'test', label: 'Probar modo offline', completed: false },
    { id: 'theta', label: 'Conectar Theta Z1', completed: false },
  ];

  return (
    <Card className="relative border-primary/50 animate-fade-in">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-8 w-8 p-0"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          Guía Rápida: Trabajo Offline
        </CardTitle>
        <CardDescription>
          Sigue estos pasos para trabajar sin conexión
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          {checklist.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={item.completed ? 'text-muted-foreground line-through' : ''}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-4 flex gap-2">
          <Button onClick={onOpenTutorial} className="flex-1">
            <HelpCircle className="w-4 h-4 mr-2" />
            Ver Tutorial Completo
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          💡 Tip: Prepara tus tours antes de ir al campo para trabajar sin internet
        </div>
      </CardContent>
    </Card>
  );
}
