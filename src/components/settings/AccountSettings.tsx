import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CreditCard } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';

interface AccountSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

export const AccountSettings = ({ settings, onUpdate }: AccountSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle>Account</CardTitle>
        </div>
        <CardDescription>Manage your account and subscription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Subscription Tier</Label>
          <div className="mt-2">
            <Badge variant="default" className="text-sm py-1 px-3">
              {settings.subscription_tier.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Your current subscription plan
          </p>
        </div>

        <div className="space-y-3">
          <Label>Contact Preferences</Label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-normal">Email Notifications</Label>
              <Switch
                checked={settings.contact_preferences.email}
                onCheckedChange={(checked) => 
                  onUpdate({ 
                    contact_preferences: { ...settings.contact_preferences, email: checked } 
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Phone Notifications</Label>
              <Switch
                checked={settings.contact_preferences.phone}
                onCheckedChange={(checked) => 
                  onUpdate({ 
                    contact_preferences: { ...settings.contact_preferences, phone: checked } 
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">SMS Notifications</Label>
              <Switch
                checked={settings.contact_preferences.sms}
                onCheckedChange={(checked) => 
                  onUpdate({ 
                    contact_preferences: { ...settings.contact_preferences, sms: checked } 
                  })
                }
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
