import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';

interface AppearanceSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

export const AppearanceSettings = ({ settings, onUpdate }: AppearanceSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle>Appearance</CardTitle>
        </div>
        <CardDescription>Customize how the app looks and feels</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="theme">Theme</Label>
            <Select 
              value={settings.theme} 
              onValueChange={(value) => onUpdate({ theme: value as any })}
            >
              <SelectTrigger id="theme" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="font_size">Font Size</Label>
            <Select 
              value={settings.font_size} 
              onValueChange={(value) => onUpdate({ font_size: value as any })}
            >
              <SelectTrigger id="font_size" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="layout_mode">Layout Mode</Label>
            <Select 
              value={settings.layout_mode} 
              onValueChange={(value) => onUpdate({ layout_mode: value as any })}
            >
              <SelectTrigger id="layout_mode" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="extended">Extended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="color_scheme">Color Scheme</Label>
            <Select 
              value={settings.color_scheme} 
              onValueChange={(value) => onUpdate({ color_scheme: value })}
            >
              <SelectTrigger id="color_scheme" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="blue">Blue</SelectItem>
                <SelectItem value="green">Green</SelectItem>
                <SelectItem value="purple">Purple</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
