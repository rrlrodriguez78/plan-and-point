import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Download, Wifi, Camera, RefreshCw, CheckCircle2 } from 'lucide-react';

interface OfflineQuickGuideProps {
  variant?: 'alert' | 'card';
  onDismiss?: () => void;
}

export function OfflineQuickGuide({ variant = 'card', onDismiss }: OfflineQuickGuideProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
    localStorage.setItem('offline_guide_dismissed', 'true');
  };

  if (dismissed || localStorage.getItem('offline_guide_dismissed') === 'true') {
    return null;
  }

  const steps = [
    {
      icon: Download,
      title: 'Prepara tours offline',
      description: 'En el Editor, presiona "Preparar offline" para descargar un tour con todos sus datos'
    },
    {
      icon: Wifi,
      title: 'Desconecta tu internet',
      description: 'Puedes seguir trabajando sin conexión. Los datos estarán disponibles en tu dispositivo'
    },
    {
      icon: Camera,
      title: 'Captura fotos con Theta',
      description: 'En modo offline, captura fotos 360° que se guardarán localmente'
    },
    {
      icon: RefreshCw,
      title: 'Sincronización automática',
      description: 'Al reconectar, las fotos se sincronizan automáticamente a la nube'
    },
  ];

  if (variant === 'alert') {
    return (
      <Alert className="relative animate-fade-in border-primary/50">
        <CheckCircle2 className="h-4 w-4" />
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
        <AlertTitle>Guía Rápida: Modo Offline</AlertTitle>
        <AlertDescription className="space-y-2 mt-2">
          <ol className="list-decimal list-inside space-y-1 text-sm">
            {steps.map((step, index) => (
              <li key={index} className="text-muted-foreground">
                <strong>{step.title}:</strong> {step.description}
              </li>
            ))}
          </ol>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="relative animate-fade-in border-primary/50">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-8 w-8 p-0"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          Guía Rápida: Modo Offline
        </CardTitle>
        <CardDescription>
          Cómo trabajar sin conexión con Virtual Tour 360
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-1">{step.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{index + 1}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            💡 Tip: Gestiona tus tours en caché desde el menú "Caché Offline"
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
