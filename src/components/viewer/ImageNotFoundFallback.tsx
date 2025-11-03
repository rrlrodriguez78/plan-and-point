import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ImageNotFoundFallbackProps {
  imageUrl: string;
  onRetry?: () => void;
  onClose?: () => void;
  hotspotTitle?: string;
}

export const ImageNotFoundFallback = ({
  imageUrl,
  onRetry,
  onClose,
  hotspotTitle
}: ImageNotFoundFallbackProps) => {
  const fileName = imageUrl.split('/').pop() || 'unknown';
  const shortFileName = fileName.length > 50 ? fileName.substring(0, 50) + '...' : fileName;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 p-4">
      <div className="bg-destructive/95 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full shadow-2xl border-2 border-destructive">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive-foreground/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive-foreground" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-destructive-foreground">
              Error Loading Image
            </h2>
            
            {hotspotTitle && (
              <p className="text-sm text-destructive-foreground/80">
                Hotspot: {hotspotTitle}
              </p>
            )}
            
            <p className="text-destructive-foreground/90">
              Failed to load panorama. The image file does not exist or is not accessible.
            </p>
            
            <Alert variant="destructive" className="text-left bg-destructive-foreground/10 border-destructive-foreground/20">
              <AlertTitle className="text-xs font-mono">File:</AlertTitle>
              <AlertDescription className="text-xs font-mono break-all">
                {shortFileName}
              </AlertDescription>
            </Alert>
            
            <p className="text-xs text-destructive-foreground/70 mt-4">
              This image may need to be re-uploaded. Contact your administrator if this problem persists.
            </p>
          </div>

          <div className="flex gap-3 mt-4">
            {onRetry && (
              <Button 
                onClick={onRetry}
                variant="outline" 
                size="lg"
                className="gap-2 bg-destructive-foreground/10 hover:bg-destructive-foreground/20 text-destructive-foreground border-destructive-foreground/30"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            )}
            <Button 
              onClick={onClose}
              size="lg"
              className="bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
