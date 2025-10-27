import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, TrendingUp, Upload } from 'lucide-react';

interface BackupProgressProps {
  visible: boolean;
  progress: {
    totalChunks: number;
    uploadedChunks: number;
    percentage: number;
    status: 'idle' | 'uploading' | 'completed' | 'error' | 'cancelled';
    currentSpeed: number;
    estimatedTimeRemaining: number;
    uploadedSize: number;
    totalSize: number;
  };
  metrics?: {
    averageSpeed: number;
    totalUploads: number;
    successfulUploads: number;
  };
}

export const BackupProgress: React.FC<BackupProgressProps> = ({
  visible,
  progress,
  metrics
}) => {
  if (!visible) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusBadge = () => {
    switch (progress.status) {
      case 'uploading':
        return <Badge variant="default" className="animate-pulse">Uploading</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-success">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  const successRate = metrics && metrics.totalUploads > 0
    ? ((metrics.successfulUploads / metrics.totalUploads) * 100).toFixed(1)
    : '0';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Creating Backup
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress.percentage} className="h-3" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {progress.percentage}% ({progress.uploadedChunks}/{progress.totalChunks} chunks)
            </span>
            <span className="font-medium">
              {formatBytes(progress.uploadedSize)} / {formatBytes(progress.totalSize)}
            </span>
          </div>
        </div>

        {/* Real-time Stats */}
        {progress.status === 'uploading' && progress.currentSpeed > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Upload Speed</p>
                <p className="text-lg font-semibold">{formatBytes(progress.currentSpeed)}/s</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Time Remaining</p>
                <p className="text-lg font-semibold">{formatTime(progress.estimatedTimeRemaining)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Section */}
        {metrics && metrics.totalUploads > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Upload Statistics</h4>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-primary/5">
                <p className="text-2xl font-bold text-primary">{successRate}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
              
              <div className="text-center p-2 rounded-lg bg-primary/5">
                <p className="text-2xl font-bold text-primary">{metrics.totalUploads}</p>
                <p className="text-xs text-muted-foreground">Total Uploads</p>
              </div>
              
              <div className="text-center p-2 rounded-lg bg-primary/5">
                <p className="text-sm font-bold text-primary">{formatBytes(metrics.averageSpeed)}/s</p>
                <p className="text-xs text-muted-foreground">Avg Speed</p>
              </div>
            </div>
          </div>
        )}

        {/* Completion Message */}
        {progress.status === 'completed' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">Backup completed successfully!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
