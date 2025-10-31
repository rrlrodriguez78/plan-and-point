import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useUserSettingsContext } from '@/contexts/UserSettingsContext';
import { RefreshCw } from 'lucide-react';

export function PWAUpdateSettings() {
  const { settings, updateSettings } = useUserSettingsContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Actualizaciones de la App
        </CardTitle>
        <CardDescription>
          Configura cómo quieres recibir actualizaciones de la aplicación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Actualización automática</Label>
              <p className="text-sm text-muted-foreground">
                La app se actualizará automáticamente cuando haya una nueva versión
              </p>
            </div>
            <Switch
              checked={settings.pwa_auto_update}
              onCheckedChange={(checked) =>
                updateSettings({ pwa_auto_update: checked })
              }
            />
          </div>

          {settings.pwa_auto_update && (
            <div className="pl-4 border-l-2 border-border space-y-2">
              <Label>Tiempo de espera antes de actualizar</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[settings.pwa_auto_update_delay / 1000]}
                  onValueChange={([value]) =>
                    updateSettings({ pwa_auto_update_delay: value * 1000 })
                  }
                  min={5}
                  max={60}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-12">
                  {settings.pwa_auto_update_delay / 1000}s
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tiempo que tendrás para cancelar la actualización automática
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-0.5">
              <Label>Notificaciones del navegador</Label>
              <p className="text-sm text-muted-foreground">
                Recibir notificaciones del sistema cuando haya actualizaciones
              </p>
            </div>
            <Switch
              checked={settings.pwa_browser_notifications}
              onCheckedChange={async (checked) => {
                if (checked && 'Notification' in window) {
                  const permission = await Notification.requestPermission();
                  if (permission === 'granted') {
                    updateSettings({ pwa_browser_notifications: true });
                  }
                } else {
                  updateSettings({ pwa_browser_notifications: checked });
                }
              }}
            />
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label>Frecuencia de verificación de actualizaciones</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[settings.pwa_check_interval / 60000]}
                onValueChange={([value]) =>
                  updateSettings({ pwa_check_interval: value * 60000 })
                }
                min={15}
                max={180}
                step={15}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-16">
                {settings.pwa_check_interval / 60000}min
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cada cuánto tiempo se verificará si hay nuevas versiones
            </p>
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h4 className="text-sm font-medium">💡 Recomendaciones</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Actualización manual</strong>: Control total, actualizas cuando quieras</li>
            <li>• <strong>Con notificación</strong>: Te avisamos pero decides cuándo actualizar</li>
            <li>• <strong>Automática</strong>: Siempre tendrás la última versión sin intervención</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
