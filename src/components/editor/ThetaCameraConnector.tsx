import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  Wifi, 
  Loader2, 
  AlertTriangle, 
  Info,
  Battery,
  WifiOff,
  CheckCircle2
} from 'lucide-react';
import { useThetaCamera } from '@/hooks/useThetaCamera';
import { offlineStorage } from '@/utils/offlineStorage';
import { toast } from 'sonner';

interface ThetaCameraConnectorProps {
  hotspotId: string;
  tourId: string;
  tenantId: string;
  onPhotoSaved?: () => void;
}

export const ThetaCameraConnector = ({ 
  hotspotId, 
  tourId, 
  tenantId,
  onPhotoSaved 
}: ThetaCameraConnectorProps) => {
  const { 
    isConnected, 
    isConnecting, 
    isCapturing, 
    error,
    batteryLevel,
    connect, 
    disconnect, 
    capturePhoto 
  } = useThetaCamera();
  
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [captureCount, setCaptureCount] = useState(0);

  const handleCapture = async () => {
    const blob = await capturePhoto();
    if (!blob) return;

    try {
      // Convertir Blob a File para preview
      const filename = `theta_${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      
      // Mostrar preview local
      const url = URL.createObjectURL(blob);
      setLastCapture(url);

      // Guardar en IndexedDB para sync posterior
      toast.info('💾 Guardando foto para sincronizar...', { duration: 2000 });
      
      await offlineStorage.savePendingPhoto({
        hotspotId,
        tourId,
        tenantId,
        blob,
        captureDate: new Date(),
        filename,
      });

      setCaptureCount(prev => prev + 1);
      toast.success('✅ Foto guardada - Se sincronizará al reconectar internet');
      
      // Notificar al padre para refrescar contador
      onPhotoSaved?.();
      
    } catch (err: any) {
      console.error('Error guardando foto offline:', err);
      toast.error('Error al guardar la foto');
    }
  };

  return (
    <Card className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Ricoh Theta Z1</h3>
          {isConnected && batteryLevel !== null && (
            <Badge variant="outline" className="gap-1">
              <Battery className="w-3 h-3" />
              {batteryLevel}%
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-muted-foreground">Conectada</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={disconnect}
              >
                Desconectar
              </Button>
            </>
          ) : (
            <Button
              onClick={connect}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  Conectar Cámara
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-line">
            {error}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Instrucciones cuando no está conectada */}
      {!isConnected && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-2">Para usar la cámara Theta Z1:</p>
            <ol className="list-decimal ml-4 space-y-1 text-sm">
              <li>Enciende la cámara Theta Z1</li>
              <li>En tu dispositivo, ve a Configuración WiFi</li>
              <li>Conéctate a la red <code className="bg-muted px-1 rounded">THETAXXXX</code></li>
              <li>Vuelve aquí y haz clic en "Conectar Cámara"</li>
            </ol>
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
              <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> Al conectarte al WiFi de la cámara, perderás acceso a internet temporalmente. 
                Las fotos se guardarán localmente y se subirán automáticamente cuando reconectes a internet.
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* UI de captura cuando está conectada */}
      {isConnected && (
        <div className="space-y-4">
          {/* Live Preview Placeholder */}
          <div className="relative aspect-[2/1] bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg overflow-hidden border-2 border-dashed border-primary/20 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Camera className="w-12 h-12 text-primary/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Vista de la cámara
              </p>
              <p className="text-xs text-muted-foreground">
                (Live preview disponible en próxima versión)
              </p>
            </div>
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LISTA
            </div>
          </div>
          
          {/* Botón de Captura */}
          <Button
            onClick={handleCapture}
            disabled={isCapturing}
            size="lg"
            className="w-full gap-2 h-16 text-lg font-semibold"
          >
            {isCapturing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Capturando foto 360°...
              </>
            ) : (
              <>
                <Camera className="w-6 h-6" />
                Capturar Foto 360°
              </>
            )}
          </Button>

          {/* Contador de capturas */}
          {captureCount > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {captureCount} foto(s) capturada(s) en esta sesión
                  </span>
                  <Badge variant="secondary">
                    {captureCount}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Última captura */}
          {lastCapture && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Última captura:
              </p>
              <div className="relative rounded-lg overflow-hidden border-2 border-green-500">
                <img 
                  src={lastCapture}
                  alt="Última captura"
                  className="w-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                  Guardada
                </div>
              </div>
            </div>
          )}

          {/* Información offline */}
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <p className="font-medium mb-1">Modo Offline Activado</p>
              <p>
                Las fotos se están guardando localmente. Se subirán automáticamente 
                al servidor cuando reconectes a internet.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </Card>
  );
};
