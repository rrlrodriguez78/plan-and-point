import { Button } from '@/components/ui/button';
import { Maximize2, Info, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface ViewerHeaderProps {
  tourTitle: string;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

export const ViewerHeader = ({ tourTitle, onToggleFullscreen, isFullscreen }: ViewerHeaderProps) => {
  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Enlace copiado al portapapeles');
  };

  const handleHelp = () => {
    toast.info('Haz clic en los puntos azules para ver más información. Usa la rueda del ratón para hacer zoom.');
  };

  return (
    <div className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{tourTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleHelp}>
              <Info className="w-4 h-4 mr-2" />
              Ayuda
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Compartir
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleFullscreen}>
              <Maximize2 className="w-4 h-4 mr-2" />
              {isFullscreen ? 'Salir' : 'Pantalla completa'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
