import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCloudStorage } from '@/hooks/useCloudStorage';
import { CheckCircle, XCircle, Clock, RefreshCw, Cloud, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Props {
  tenantId: string;
}

export const BackupSyncHistory: React.FC<Props> = ({ tenantId }) => {
  const { syncHistory, loadingProvider, clearSyncHistory } = useCloudStorage(tenantId);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearHistory = async () => {
    try {
      setIsClearing(true);
      await clearSyncHistory();
      toast.success('History cleared successfully');
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('Error clearing history');
    } finally {
      setIsClearing(false);
    }
  };

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>📜 Cloud Sync History</CardTitle>
            <CardDescription>Recent synchronizations to cloud storage</CardDescription>
          </div>
          
          {syncHistory.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isClearing}
                  className="h-11 md:h-9"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete all sync records.
                    Files in Google Drive will NOT be deleted, only the local history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearHistory}>
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
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
                className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-4"
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
