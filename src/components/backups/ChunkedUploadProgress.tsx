import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, CheckCircle2 } from "lucide-react";

interface ChunkedUploadProgressProps {
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  onCancel?: () => void;
  estimatedTimeRemaining?: number;
}

export const ChunkedUploadProgress = ({
  progress,
  status,
  onCancel,
  estimatedTimeRemaining,
}: ChunkedUploadProgressProps) => {
  const [startTime] = useState(Date.now());
  const [displayTime, setDisplayTime] = useState<string>("");

  useEffect(() => {
    if (estimatedTimeRemaining) {
      const minutes = Math.floor(estimatedTimeRemaining / 60);
      const seconds = estimatedTimeRemaining % 60;
      setDisplayTime(`${minutes}m ${seconds}s restantes`);
    }
  }, [estimatedTimeRemaining]);

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return `Subiendo backup... ${progress}%`;
      case 'processing':
        return 'Procesando imágenes...';
      case 'completed':
        return '¡Backup subido exitosamente!';
      case 'error':
        return 'Error al subir backup';
    }
  };

  const getStatusIcon = () => {
    if (status === 'completed') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    return <Upload className="w-5 h-5 text-primary animate-pulse" />;
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <p className="font-medium">{getStatusText()}</p>
            {displayTime && status === 'uploading' && (
              <p className="text-sm text-muted-foreground">{displayTime}</p>
            )}
          </div>
        </div>
        {status === 'uploading' && onCancel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            title="Cancelar subida"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {status !== 'completed' && (
        <Progress value={progress} className="w-full" />
      )}
    </Card>
  );
};
