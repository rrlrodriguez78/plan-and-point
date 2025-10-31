import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Globe, Images } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface TourTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: '360' | 'photos') => void;
}

export const TourTypeSelector = ({ isOpen, onClose, onSelect }: TourTypeSelectorProps) => {
  const { t } = useTranslation();

  const handleSelect = (type: '360' | 'photos') => {
    onSelect(type);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {t('tourTypeSelector.title')}
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {t('tourTypeSelector.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
          {/* Tours 360° Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Button
              variant="outline"
              onClick={() => handleSelect('360')}
              className="h-auto w-full p-6 flex flex-col items-center gap-4 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 text-white border-0 hover:scale-105 hover:shadow-2xl transition-all duration-300 group"
            >
              <div className="p-4 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors">
                <Globe className="w-12 h-12" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold">{t('tourTypeSelector.tour360.title')}</h3>
                <p className="text-sm text-white/90 leading-relaxed">
                  {t('tourTypeSelector.tour360.description')}
                </p>
              </div>
            </Button>
          </motion.div>

          {/* Tours de Fotos Button */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Button
              variant="outline"
              onClick={() => handleSelect('photos')}
              className="h-auto w-full p-6 flex flex-col items-center gap-4 bg-gradient-to-br from-green-400 via-teal-500 to-cyan-600 text-white border-0 hover:scale-105 hover:shadow-2xl transition-all duration-300 group"
            >
              <div className="p-4 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors">
                <Images className="w-12 h-12" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold">{t('tourTypeSelector.photoTour.title')}</h3>
                <p className="text-sm text-white/90 leading-relaxed">
                  {t('tourTypeSelector.photoTour.description')}
                </p>
              </div>
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
