import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useCloudStorage } from '@/hooks/useCloudStorage';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface Props {
  tenantId: string;
}

export const CloudProviderSelector: React.FC<Props> = ({ tenantId }) => {
  const { 
    destinations, 
    loadingProvider,
    connectProvider,
    disconnectProvider,
    testConnection
  } = useCloudStorage(tenantId);

  const googleDriveDestination = destinations.find(
    d => d.cloud_provider === 'google_drive' && d.is_active
  );

  const dropboxDestination = destinations.find(
    d => d.cloud_provider === 'dropbox' && d.is_active
  );

  const isConnectingGoogle = loadingProvider === 'google_drive';
  const isConnectingDropbox = loadingProvider === 'dropbox';

  return (
    <div className="space-y-4">
      <Label className="text-base">Select Cloud Provider</Label>

      {/* Google Drive */}
      <Card className={googleDriveDestination ? 'border-primary' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center text-white">
                📁
              </div>
              <div>
                <div className="font-medium flex items-center gap-2">
                  Google Drive
                  {googleDriveDestination && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">15 GB free storage</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {googleDriveDestination ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testConnection(googleDriveDestination.id)}
                    disabled={!!loadingProvider}
                  >
                    {loadingProvider === 'testing' ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Test'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => disconnectProvider(googleDriveDestination.id)}
                    disabled={!!loadingProvider}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectProvider('google_drive')}
                  disabled={isConnectingGoogle}
                >
                  {isConnectingGoogle ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dropbox */}
      <Card className={dropboxDestination ? 'border-primary' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center text-white">
                📦
              </div>
              <div>
                <div className="font-medium flex items-center gap-2">
                  Dropbox
                  {dropboxDestination && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">2 GB free storage</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dropboxDestination ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testConnection(dropboxDestination.id)}
                    disabled={!!loadingProvider}
                  >
                    {loadingProvider === 'testing' ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Test'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => disconnectProvider(dropboxDestination.id)}
                    disabled={!!loadingProvider}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectProvider('dropbox')}
                  disabled={isConnectingDropbox}
                >
                  {isConnectingDropbox ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {(googleDriveDestination || dropboxDestination) && (
        <div className="text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Your backups will be synced to {googleDriveDestination ? 'Google Drive' : 'Dropbox'} automatically.
          </p>
        </div>
      )}
    </div>
  );
};
