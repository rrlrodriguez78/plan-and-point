import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserSettingsContext } from '@/contexts/UserSettingsContext';
import { Settings } from 'lucide-react';

export const SettingsStatusWidget = () => {
  const { settings } = useUserSettingsContext();
  
  const getSyncFrequencyLabel = (frequency: string) => {
    switch(frequency) {
      case 'hourly': return 'Cada hora';
      case 'daily': return 'Diaria';
      case 'weekly': return 'Semanal';
      case 'manual': return 'Manual';
      default: return frequency;
    }
  };
  
  const getImageQualityLabel = (quality: string) => {
    switch(quality) {
      case 'low': return 'Baja (60%)';
      case 'medium': return 'Media (75%)';
      case 'high': return 'Alta (85%)';
      default: return quality;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Configuración Activa</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Límite almacenamiento:</span>
            <span className="font-medium">{settings.local_storage_limit_mb}MB</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Calidad imagen:</span>
            <span className="font-medium">{getImageQualityLabel(settings.image_quality)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Sincronización:</span>
            <span className={`font-medium ${settings.cloud_sync ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {settings.cloud_sync ? 'Activa' : 'Desactivada'}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Frecuencia backup:</span>
            <span className="font-medium">{getSyncFrequencyLabel(settings.backup_frequency)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Volumen:</span>
            <span className="font-medium">{settings.default_volume}%</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
};
