import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Smartphone } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';

interface MobileSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

export const MobileSettings = ({ settings, onUpdate }: MobileSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <CardTitle>Mobile Settings</CardTitle>
        </div>
        <CardDescription>Optimize settings for mobile devices</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="image_quality">Image Quality</Label>
            <Select 
              value={settings.image_quality} 
              onValueChange={(value) => onUpdate({ image_quality: value as any })}
            >
              <SelectTrigger id="image_quality" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="data_usage">Data Usage</Label>
            <Select 
              value={settings.data_usage} 
              onValueChange={(value) => onUpdate({ data_usage: value as any })}
            >
              <SelectTrigger id="data_usage" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (Save Data)</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="high">High (Best Quality)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto Downloads</Label>
            <p className="text-xs text-muted-foreground">
              Automatically download tour content
            </p>
          </div>
          <Switch
            checked={settings.auto_downloads}
            onCheckedChange={(checked) => onUpdate({ auto_downloads: checked })}
          />
        </div>

        <div>
          <Label>Local Storage Limit (MB)</Label>
          <div className="flex items-center gap-4 mt-2">
            <Slider
              value={[settings.local_storage_limit_mb]}
              onValueChange={([value]) => onUpdate({ local_storage_limit_mb: value })}
              min={100}
              max={2000}
              step={100}
              className="flex-1"
            />
            <span className="text-sm font-medium w-16 text-right">
              {settings.local_storage_limit_mb} MB
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Maximum storage for cached content
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
