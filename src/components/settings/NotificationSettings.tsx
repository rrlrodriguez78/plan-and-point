import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bell, Mail, Smartphone, TrendingUp } from 'lucide-react';

export const NotificationSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    email_on_new_view: true,
    email_on_new_user: true,
    email_weekly_report: true,
    push_on_new_view: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          ...settings
        });

      if (error) throw error;

      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Configuración de Notificaciones</h3>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Notificaciones por Email</h4>
          </div>
          <div className="space-y-4 ml-7">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-new-view" className="cursor-pointer flex-1">
                <div>
                  <div className="font-medium">Nueva vista en tour</div>
                  <div className="text-sm text-muted-foreground">
                    Recibe un email cuando alguien vea tus tours
                  </div>
                </div>
              </Label>
              <Switch
                id="email-new-view"
                checked={settings.email_on_new_view}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, email_on_new_view: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="email-new-user" className="cursor-pointer flex-1">
                <div>
                  <div className="font-medium">Nuevo usuario registrado</div>
                  <div className="text-sm text-muted-foreground">
                    Notificación cuando alguien se registra
                  </div>
                </div>
              </Label>
              <Switch
                id="email-new-user"
                checked={settings.email_on_new_user}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, email_on_new_user: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="email-weekly" className="cursor-pointer flex-1">
                <div>
                  <div className="font-medium">Reporte semanal</div>
                  <div className="text-sm text-muted-foreground">
                    Resumen de actividad cada semana
                  </div>
                </div>
              </Label>
              <Switch
                id="email-weekly"
                checked={settings.email_weekly_report}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, email_weekly_report: checked })
                }
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Notificaciones Push</h4>
          </div>
          <div className="space-y-4 ml-7">
            <div className="flex items-center justify-between">
              <Label htmlFor="push-new-view" className="cursor-pointer flex-1">
                <div>
                  <div className="font-medium">Vista en tiempo real</div>
                  <div className="text-sm text-muted-foreground">
                    Notificación instantánea cuando alguien vea tus tours
                  </div>
                </div>
              </Label>
              <Switch
                id="push-new-view"
                checked={settings.push_on_new_view}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, push_on_new_view: checked })
                }
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
