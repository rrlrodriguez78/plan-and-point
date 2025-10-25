import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Volume2 } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';

interface AudioVideoSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

export const AudioVideoSettings = ({ settings, onUpdate }: AudioVideoSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-primary" />
          <CardTitle>Audio & Video</CardTitle>
        </div>
        <CardDescription>Configure media playback settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Default Volume</Label>
          <div className="flex items-center gap-4 mt-2">
            <Slider
              value={[settings.default_volume]}
              onValueChange={([value]) => onUpdate({ default_volume: value })}
              min={0}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12 text-right">
              {settings.default_volume}%
            </span>
          </div>
        </div>

        <div>
          <Label htmlFor="video_quality">Video Quality</Label>
          <Select 
            value={settings.video_quality} 
            onValueChange={(value) => onUpdate({ video_quality: value as any })}
          >
            <SelectTrigger id="video_quality" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="low">Low (360p)</SelectItem>
              <SelectItem value="medium">Medium (720p)</SelectItem>
              <SelectItem value="high">High (1080p)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Autoplay</Label>
            <p className="text-xs text-muted-foreground">
              Automatically play videos when viewing tours
            </p>
          </div>
          <Switch
            checked={settings.autoplay}
            onCheckedChange={(checked) => onUpdate({ autoplay: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Sound Effects</Label>
            <p className="text-xs text-muted-foreground">
              Enable UI sound effects
            </p>
          </div>
          <Switch
            checked={settings.sound_effects}
            onCheckedChange={(checked) => onUpdate({ sound_effects: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
};
