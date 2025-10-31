import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCloudStorage } from '@/hooks/useCloudStorage';
import { CheckCircle, XCircle, Clock, RefreshCw, Cloud } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  tenantId: string;
}

export const BackupSyncHistory: React.FC<Props> = ({ tenantId }) => {
  const { syncHistory, loadingProvider } = useCloudStorage(tenantId);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500';
      case 'failed':
        return 'bg-red-500/10 text-red-500';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loadingProvider) {
    return (
      <div className="flex justify-center items-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading sync history...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>📜 Cloud Sync History</CardTitle>
        <CardDescription>Recent synchronizations to cloud storage</CardDescription>
      </CardHeader>
      <CardContent>
        {syncHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No sync history yet</p>
            <p className="text-sm mt-1">Backups will appear here once synced to cloud</p>
          </div>
        ) : (
          <div className="space-y-4">
            {syncHistory.map((sync) => (
              <div
                key={sync.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(sync.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{sync.sync_type} Sync</span>
                      <Badge variant="secondary" className={getStatusColor(sync.status)}>
                        {sync.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {sync.files_synced} files • {formatFileSize(sync.total_size_bytes)} • 
                      {sync.started_at && ` ${format(new Date(sync.started_at), 'MMM dd, yyyy HH:mm')}`}
                    </div>
                    {sync.error_message && (
                      <div className="text-sm text-red-600 mt-1">
                        Error: {sync.error_message}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {sync.completed_at ? (
                    <span>
                      Completed {format(new Date(sync.completed_at), 'HH:mm')}
                    </span>
                  ) : (
                    <span>In progress...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
