import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrientationWarningProps {
  onDismiss: () => void;
}

export const OrientationWarning = ({ onDismiss }: OrientationWarningProps) => {
  const { t } = useTranslation();
  
  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center px-6 max-w-md">
        {/* Icono animado de teléfono rotando */}
        <div className="mb-6 flex justify-center">
          <Smartphone 
            className="w-24 h-24 text-primary animate-[spin_2s_ease-in-out_infinite]" 
          />
        </div>
        
        {/* Textos */}
        <h2 className="text-2xl font-bold mb-3 text-foreground">
          {t('orientation.rotateDevice')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('orientation.landscapeRequired')}
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          {t('orientation.instruction')}
        </p>
        
        {/* Botón para continuar de todos modos */}
        <Button
          variant="outline"
          onClick={onDismiss}
          className="mt-4"
        >
          {t('orientation.continueAnyway')}
        </Button>
      </div>
    </div>
  );
};
