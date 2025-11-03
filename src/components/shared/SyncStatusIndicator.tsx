import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Wifi, WifiOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface SyncStatusIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  syncProgress?: number;
  currentOperation?: string | null;
  pendingCount?: number;
  variant?: 'compact' | 'detailed';
  clickable?: boolean;
}

export function SyncStatusIndicator({
  isOnline,
  isSyncing,
  syncProgress = 0,
  currentOperation,
  pendingCount = 0,
  variant = 'compact',
  clickable = true,
}: SyncStatusIndicatorProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (clickable && variant === 'compact') {
      navigate('/app/offline-cache');
    }
  };
  
  if (variant === 'compact') {
    return (
      <div 
        className={cn(
          "flex items-center gap-2",
          clickable && "cursor-pointer transition-opacity hover:opacity-80"
        )}
        onClick={handleClick}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
      >
        {/* Connection status */}
        <Badge 
          variant={isOnline ? "default" : "secondary"}
          className={cn(
            "gap-1.5 transition-all",
            isOnline ? "bg-green-500/20 text-green-700 dark:text-green-400" : "bg-muted"
          )}
        >
          {isOnline ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          {isOnline ? 'Online' : 'Offline'}
        </Badge>

        {/* Sync status */}
        {isSyncing && (
          <Badge variant="outline" className="gap-1.5 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Sincronizando
          </Badge>
        )}

        {/* Pending count */}
        {pendingCount > 0 && !isSyncing && (
          <Badge variant="secondary" className="gap-1.5">
            <AlertCircle className="w-3 h-3" />
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Badge>
        )}

        {/* Success indicator */}
        {!isSyncing && pendingCount === 0 && isOnline && (
          <Badge variant="outline" className="gap-1.5 text-green-600 border-green-300">
            <CheckCircle2 className="w-3 h-3" />
            Sincronizado
          </Badge>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {isOnline ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>
        
        {pendingCount > 0 && (
          <Badge variant="secondary">
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {isSyncing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {currentOperation || 'Sincronizando...'}
            </span>
            <span className="font-medium">{syncProgress}%</span>
          </div>
          <Progress value={syncProgress} className="h-2" />
        </div>
      )}

      {!isSyncing && pendingCount === 0 && isOnline && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <span>Todos los datos sincronizados</span>
        </div>
      )}

      {!isOnline && pendingCount > 0 && (
        <div className="text-sm text-muted-foreground">
          Los datos se sincronizarán automáticamente al conectarse
        </div>
      )}
    </div>
  );
}
