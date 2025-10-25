import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, LayoutGrid, Settings, FileText, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export const QuickActions = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const actions = [
    {
      icon: <Plus className="w-5 h-5" />,
      label: t('inicio.createNewTour'),
      onClick: () => navigate('/app/tours'),
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <LayoutGrid className="w-5 h-5" />,
      label: t('inicio.viewAllTours'),
      onClick: () => navigate('/app/tours'),
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: <FileText className="w-5 h-5" />,
      label: t('inicio.viewReport'),
      onClick: () => console.log('View report'),
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: 'Settings',
      onClick: () => navigate('/app/settings'),
      color: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <Card className="p-6 border-2 border-accent/20 bg-gradient-to-br from-background to-accent/5 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold font-futuristic flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent" />
          {t('inicio.quickActions')}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 font-body-future">
          Fast access to common tasks
        </p>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {actions.map((action, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={action.onClick}
              className={`w-full justify-start gap-3 h-14 bg-gradient-to-r ${action.color} hover:opacity-90 text-white font-body-future font-semibold`}
            >
              <div className="p-2 rounded-lg bg-white/20">
                {action.icon}
              </div>
              {action.label}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Tip Section */}
      <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-xs text-muted-foreground font-body-future">
          💡 <strong>Tip:</strong> Create multiple tours and publish them to start tracking analytics
        </p>
      </div>
    </Card>
  );
};
