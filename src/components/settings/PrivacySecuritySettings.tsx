import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Shield } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';

interface PrivacySecuritySettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

export const PrivacySecuritySettings = ({ settings, onUpdate }: PrivacySecuritySettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Privacy & Security</CardTitle>
        </div>
        <CardDescription>Manage your privacy and security settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="profile_visibility">Profile Visibility</Label>
          <Select 
            value={settings.profile_visibility} 
            onValueChange={(value) => onUpdate({ profile_visibility: value as any })}
          >
            <SelectTrigger id="profile_visibility" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="friends">Friends Only</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Control who can see your profile
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Data Sharing</Label>
            <p className="text-xs text-muted-foreground">
              Share anonymous data to improve the service
            </p>
          </div>
          <Switch
            checked={settings.data_sharing}
            onCheckedChange={(checked) => onUpdate({ data_sharing: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Two-Factor Authentication</Label>
            <p className="text-xs text-muted-foreground">
              Add an extra layer of security
            </p>
          </div>
          <Switch
            checked={settings.two_factor_enabled}
            onCheckedChange={(checked) => onUpdate({ two_factor_enabled: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
};
