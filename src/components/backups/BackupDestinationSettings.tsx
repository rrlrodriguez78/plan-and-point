import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useCloudStorage } from '@/hooks/useCloudStorage';
import { CloudProviderSelector } from './CloudProviderSelector';
import { Cloud, HardDrive, RefreshCw } from 'lucide-react';

interface Props {
  tenantId: string;
}

export const BackupDestinationSettings: React.FC<Props> = ({ tenantId }) => {
  const { 
    destinations, 
    loadingProvider,
    toggleAutoBackup,
    getActiveDestination 
  } = useCloudStorage(tenantId);

  const activeDestination = getActiveDestination();
  const [destinationType, setDestinationType] = useState<'local_download' | 'cloud_storage' | 'both'>(
    activeDestination?.destination_type || 'local_download'
  );

  const handleDestinationTypeChange = (value: string) => {
    setDestinationType(value as any);
  };

  if (loadingProvider && destinations.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📁 Backup Destinations</CardTitle>
          <CardDescription>Choose where to save your tour backups</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={destinationType} onValueChange={handleDestinationTypeChange}>
            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="local_download" id="local" />
              <Label htmlFor="local" className="flex items-center gap-2 cursor-pointer flex-1">
                <HardDrive className="h-5 w-5" />
                <div>
                  <div className="font-medium">💻 Local Download</div>
                  <div className="text-sm text-muted-foreground">Save backup as ZIP file to your PC</div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="cloud_storage" id="cloud" />
              <Label htmlFor="cloud" className="flex items-center gap-2 cursor-pointer flex-1">
                <Cloud className="h-5 w-5" />
                <div>
                  <div className="font-medium">☁️ Cloud Storage</div>
                  <div className="text-sm text-muted-foreground">Automatically sync to Google Drive or Dropbox</div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="both" id="both" />
              <Label htmlFor="both" className="flex items-center gap-2 cursor-pointer flex-1">
                <RefreshCw className="h-5 w-5" />
                <div>
                  <div className="font-medium">🔄 Both (Local + Cloud)</div>
                  <div className="text-sm text-muted-foreground">Download ZIP and sync to cloud simultaneously</div>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {(destinationType === 'cloud_storage' || destinationType === 'both') && (
            <div className="pt-4 border-t">
              <CloudProviderSelector tenantId={tenantId} />
            </div>
          )}

          {activeDestination && (destinationType === 'cloud_storage' || destinationType === 'both') && (
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Auto-backup on photo upload</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically backup new photos to cloud storage
                  </p>
                </div>
                <Switch
                  checked={activeDestination.auto_backup_enabled}
                  onCheckedChange={(checked) => toggleAutoBackup(activeDestination.id, checked)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ℹ️ Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-1">💻 Local Download</h4>
            <p className="text-muted-foreground">
              Creates a ZIP file with organized folders that you can download to your PC. 
              Includes all tour data, floor plans, and photos with metadata.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">☁️ Cloud Storage</h4>
            <p className="text-muted-foreground">
              Automatically syncs your backups to Google Drive or Dropbox with the same organized structure. 
              Perfect for automatic backups and cross-device access.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">🔄 Both</h4>
            <p className="text-muted-foreground">
              Get the best of both worlds - download a local copy and automatically sync to cloud storage 
              for maximum data security and redundancy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
