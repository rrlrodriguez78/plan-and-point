import React from 'react';
import { useCloudStorage } from '@/hooks/useCloudStorage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BackupSettingsProps {
  tenantId: string;
}

const BackupSettings: React.FC<BackupSettingsProps> = ({ tenantId }) => {
  const {
    destinations,
    loadingProvider,
    connectProvider,
    disconnectProvider,
    testConnection,
    getActiveDestination
  } = useCloudStorage(tenantId);

  const activeDestination = getActiveDestination();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cloud Storage Backup</CardTitle>
          <CardDescription>
            Connect your cloud storage to automatically backup your photos and tours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Drive Connection */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">G</span>
              </div>
              <div>
                <h3 className="font-semibold">Google Drive</h3>
                <p className="text-sm text-muted-foreground">
                  {activeDestination?.cloud_provider === 'google_drive' 
                    ? 'Connected' 
                    : 'Not connected'}
                </p>
              </div>
            </div>
            
            {activeDestination?.cloud_provider === 'google_drive' ? (
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={() => testConnection(activeDestination.id)}
                  disabled={loadingProvider === 'testing'}
                  className="h-11 md:h-10 w-full sm:w-auto"
                >
                  {loadingProvider === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => disconnectProvider(activeDestination.id)}
                  disabled={loadingProvider === 'disconnecting'}
                  className="h-11 md:h-10 w-full sm:w-auto"
                >
                  {loadingProvider === 'disconnecting' ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => connectProvider('google_drive')}
                disabled={loadingProvider === 'google_drive'}
                className="bg-blue-600 hover:bg-blue-700 h-11 md:h-10 w-full sm:w-auto"
              >
                {loadingProvider === 'google_drive' ? 'Connecting...' : 'Connect'}
              </Button>
            )}
          </div>

          {/* Status Information */}
          {activeDestination && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                ✅ Connected to {activeDestination.cloud_provider}
                {activeDestination.last_backup_at && (
                  <span className="block text-green-600">
                    Last backup: {new Date(activeDestination.last_backup_at).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupSettings;
