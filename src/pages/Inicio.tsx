import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { StatsCard } from '@/components/analytics/StatsCard';
import { ViewsChart } from '@/components/analytics/ViewsChart';
import { TopToursChart } from '@/components/analytics/TopToursChart';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { QuickActions } from '@/components/analytics/QuickActions';
import { DistributionPieChart } from '@/components/analytics/DistributionPieChart';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Eye, Heart, MessageSquare, TrendingUp } from 'lucide-react';

interface AnalyticsData {
  totalTours: number;
  publishedTours: number;
  draftTours: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  unreadComments: number;
}

const Inicio = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalTours: 0,
    publishedTours: 0,
    draftTours: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    unreadComments: 0,
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    loadAnalytics();
  }, [user, navigate]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get user's organization
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user?.id)
        .single();

      if (!orgData) {
        setLoading(false);
        return;
      }

      // Get tours count
      const { data: tours } = await supabase
        .from('virtual_tours')
        .select('id, is_published')
        .eq('organization_id', orgData.id);

      const totalTours = tours?.length || 0;
      const publishedTours = tours?.filter(t => t.is_published).length || 0;
      const draftTours = totalTours - publishedTours;

      // Get analytics data (types will be regenerated after migration)
      const analyticsQuery = await supabase
        .from('tour_analytics' as any)
        .select('views_count, likes_count, comments_count')
        .in('tour_id', tours?.map(t => t.id) || []);

      const analyticsData = analyticsQuery.data as any[];
      const totalViews = analyticsData?.reduce((sum: number, a: any) => sum + (a.views_count || 0), 0) || 0;
      const totalLikes = analyticsData?.reduce((sum: number, a: any) => sum + (a.likes_count || 0), 0) || 0;
      const totalCommentsCount = analyticsData?.reduce((sum: number, a: any) => sum + (a.comments_count || 0), 0) || 0;

      // Get unread comments (types will be regenerated after migration)
      const commentsQuery = await supabase
        .from('tour_comments' as any)
        .select('id, is_read')
        .in('tour_id', tours?.map(t => t.id) || [])
        .eq('is_read', false);

      const comments = commentsQuery.data as any[];

      setAnalytics({
        totalTours,
        publishedTours,
        draftTours,
        totalViews,
        totalLikes,
        totalComments: totalCommentsCount,
        unreadComments: comments?.length || 0,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="font-futuristic text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-3 animate-fade-in">
            {t('inicio.title')}
          </h1>
          <p className="text-muted-foreground text-lg font-body-future">
            {t('inicio.welcomeBack')}, {user.email}
          </p>
        </div>

        {/* Stats Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatsCard
              title={t('inicio.totalTours')}
              value={analytics.totalTours}
              subtitle={`${analytics.publishedTours} ${t('inicio.published')} · ${analytics.draftTours} ${t('inicio.draft')}`}
              icon={<BarChart3 className="w-6 h-6" />}
              trend={analytics.totalTours > 0 ? '+' + analytics.publishedTours : undefined}
              color="cyan"
            />
            <StatsCard
              title={t('inicio.totalViews')}
              value={analytics.totalViews}
              subtitle={t('inicio.viewsLastMonth')}
              icon={<Eye className="w-6 h-6" />}
              trend={analytics.totalViews > 0 ? '+12%' : undefined}
              color="blue"
            />
            <StatsCard
              title={t('inicio.totalLikes')}
              value={analytics.totalLikes}
              subtitle={t('inicio.topTours')}
              icon={<Heart className="w-6 h-6" />}
              trend={analytics.totalLikes > 0 ? '+8%' : undefined}
              color="purple"
            />
            <StatsCard
              title={t('inicio.totalComments')}
              value={analytics.totalComments}
              subtitle={`${analytics.unreadComments} unread`}
              icon={<MessageSquare className="w-6 h-6" />}
              badge={analytics.unreadComments}
              color="pink"
            />
          </div>
        )}

        {/* Charts Section */}
        {analytics.totalTours > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <div className="lg:col-span-2">
              <ViewsChart />
            </div>
            <div>
              <DistributionPieChart 
                views={analytics.totalViews}
                likes={analytics.totalLikes}
                comments={analytics.totalComments}
                shares={0}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-20 mb-12">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-2xl font-futuristic font-bold mb-2">{t('inicio.noDataYet')}</h3>
            <p className="text-muted-foreground mb-8">{t('inicio.startCreatingTours')}</p>
          </div>
        )}

        {/* Top Tours Chart */}
        {analytics.totalTours > 0 && (
          <div className="mb-12">
            <TopToursChart />
          </div>
        )}

        {/* Bottom Section: Activity Feed & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityFeed />
          </div>
          <div>
            <QuickActions />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Inicio;
