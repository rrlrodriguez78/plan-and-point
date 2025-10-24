import { Button } from '@/components/ui/button';
import { Maximize2, Info, Share2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface ViewerHeaderProps {
  tourTitle: string;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

export const ViewerHeader = ({ tourTitle, onToggleFullscreen, isFullscreen }: ViewerHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success(t('viewer.linkCopied'));
  };

  const handleHelp = () => {
    toast.info(t('viewer.helpMessage'));
  };

  const handleBack = () => {
    navigate('/app/tours');
  };

  return (
    <div className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">{tourTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleHelp}>
              <Info className="w-4 h-4 mr-2" />
              {t('viewer.help')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              {t('viewer.share')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleFullscreen}>
              <Maximize2 className="w-4 h-4 mr-2" />
              {isFullscreen ? t('viewer.exit') : t('viewer.fullscreen')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
