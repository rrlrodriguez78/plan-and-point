import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { BarChart3 } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';

interface AnalyticsSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

export const AnalyticsSettings = ({ settings, onUpdate }: AnalyticsSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle>Analytics</CardTitle>
        </div>
        <CardDescription>Configure analytics and reporting preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Share Usage Data</Label>
            <p className="text-xs text-muted-foreground">
              Help improve the app by sharing usage statistics
            </p>
          </div>
          <Switch
            checked={settings.share_usage_data}
            onCheckedChange={(checked) => onUpdate({ share_usage_data: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto Reports</Label>
            <p className="text-xs text-muted-foreground">
              Receive automatic analytics reports
            </p>
          </div>
          <Switch
            checked={settings.auto_reports}
            onCheckedChange={(checked) => onUpdate({ auto_reports: checked })}
          />
        </div>

        <div>
          <Label htmlFor="report_frequency">Report Frequency</Label>
          <Select 
            value={settings.report_frequency} 
            onValueChange={(value) => onUpdate({ report_frequency: value as any })}
          >
            <SelectTrigger id="report_frequency" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Metrics to Track</Label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-normal">Views</Label>
              <Switch
                checked={settings.metrics_to_track.views}
                onCheckedChange={(checked) => 
                  onUpdate({ 
                    metrics_to_track: { ...settings.metrics_to_track, views: checked } 
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Engagement</Label>
              <Switch
                checked={settings.metrics_to_track.engagement}
                onCheckedChange={(checked) => 
                  onUpdate({ 
                    metrics_to_track: { ...settings.metrics_to_track, engagement: checked } 
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Performance</Label>
              <Switch
                checked={settings.metrics_to_track.performance}
                onCheckedChange={(checked) => 
                  onUpdate({ 
                    metrics_to_track: { ...settings.metrics_to_track, performance: checked } 
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
