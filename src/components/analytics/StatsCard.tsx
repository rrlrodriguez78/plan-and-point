import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  badge?: number;
  color?: 'cyan' | 'blue' | 'purple' | 'pink' | 'orange' | 'green';
}

const colorMap = {
  cyan: {
    gradient: 'from-cyan-500/20 to-cyan-600/5',
    border: 'border-cyan-500/30',
    icon: 'text-cyan-500',
    glow: 'shadow-cyan-500/20',
  },
  blue: {
    gradient: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/30',
    icon: 'text-blue-500',
    glow: 'shadow-blue-500/20',
  },
  purple: {
    gradient: 'from-purple-500/20 to-purple-600/5',
    border: 'border-purple-500/30',
    icon: 'text-purple-500',
    glow: 'shadow-purple-500/20',
  },
  pink: {
    gradient: 'from-pink-500/20 to-pink-600/5',
    border: 'border-pink-500/30',
    icon: 'text-pink-500',
    glow: 'shadow-pink-500/20',
  },
  orange: {
    gradient: 'from-orange-500/20 to-orange-600/5',
    border: 'border-orange-500/30',
    icon: 'text-orange-500',
    glow: 'shadow-orange-500/20',
  },
  green: {
    gradient: 'from-green-500/20 to-green-600/5',
    border: 'border-green-500/30',
    icon: 'text-green-500',
    glow: 'shadow-green-500/20',
  },
};

export const StatsCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  badge,
  color = 'cyan' 
}: StatsCardProps) => {
  const colors = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.02, y: -5 }}
    >
      <Card className={`relative overflow-hidden border-2 ${colors.border} bg-gradient-to-br ${colors.gradient} backdrop-blur-sm hover:shadow-xl ${colors.glow} transition-all duration-300`}>
        <div className="p-6">
          {/* Icon & Badge */}
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg bg-background/50 ${colors.icon}`}>
              {icon}
            </div>
            {badge !== undefined && badge > 0 && (
              <Badge variant="destructive" className="font-bold">
                {badge}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-muted-foreground mb-2 font-body-future">
            {title}
          </h3>

          {/* Value & Trend */}
          <div className="flex items-end justify-between">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="text-4xl font-bold font-futuristic"
            >
              {value.toLocaleString()}
            </motion.div>
            
            {trend && (
              <div className="flex items-center gap-1 text-green-500 text-sm font-semibold">
                <TrendingUp className="w-4 h-4" />
                {trend}
              </div>
            )}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-2 font-body-future">
              {subtitle}
            </p>
          )}

          {/* Glow Effect */}
          <div className={`absolute -bottom-12 -right-12 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl`} />
        </div>
      </Card>
    </motion.div>
  );
};
