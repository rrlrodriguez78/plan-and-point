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
    <div className="border-b border-border bg-card safe-area-top">
      <div className="container mx-auto px-4 py-2 md:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button variant="ghost" size="sm" onClick={handleBack} className="shrink-0">
              <ArrowLeft className="w-5 h-5 md:w-4 md:h-4" />
            </Button>
            <h1 className="text-base md:text-xl font-bold text-foreground truncate">{tourTitle}</h1>
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleHelp} className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0">
              <Info className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline ml-2">{t('viewer.help')}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShare} className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0">
              <Share2 className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline ml-2">{t('viewer.share')}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleFullscreen} className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0">
              <Maximize2 className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline ml-2">{isFullscreen ? t('viewer.exit') : t('viewer.fullscreen')}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
