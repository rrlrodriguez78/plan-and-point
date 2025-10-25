import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';
import { Clock, Plus, Eye, MessageSquare, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

interface Activity {
  id: string;
  type: 'tour_created' | 'view' | 'comment' | 'like';
  title: string;
  timestamp: string;
  icon: React.ReactNode;
  color: string;
}

export const ActivityFeed = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [user]);

  const loadActivities = async () => {
    try {
      // Get user's organization
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (!orgData) return;

      // Get recent tours
      const { data: tours } = await supabase
        .from('virtual_tours')
        .select('id, title, created_at')
        .eq('organization_id', orgData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (tours) {
        const recentActivities: Activity[] = tours.map(tour => ({
          id: tour.id,
          type: 'tour_created' as const,
          title: `Created tour: ${tour.title}`,
          timestamp: tour.created_at,
          icon: <Plus className="w-4 h-4" />,
          color: 'text-green-500',
        }));

        setActivities(recentActivities);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Card className="p-6 border-2 border-muted/20 bg-gradient-to-br from-background to-muted/5 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold font-futuristic flex items-center gap-2">
          <Clock className="w-5 h-5 text-foreground" />
          {t('inicio.activityFeed')}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 font-body-future">
          Recent activity across your tours
        </p>
      </div>

      {/* Activity List */}
      <ScrollArea className="h-96">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading activities...</p>
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4 p-4 rounded-lg bg-background/50 border border-border/50 hover:border-primary/50 transition-colors"
              >
                {/* Icon */}
                <div className={`p-2 rounded-lg bg-background ${activity.color}`}>
                  {activity.icon}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <p className="font-medium font-body-future">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getTimeAgo(activity.timestamp)}
                  </p>
                </div>

                {/* Badge */}
                <Badge variant="outline" className="font-body-future">
                  {activity.type.replace('_', ' ')}
                </Badge>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Clock className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No recent activity</p>
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
