import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { StatsCard } from '@/components/analytics/StatsCard';
import { ViewsChart } from '@/components/analytics/ViewsChart';
import { TopToursChart } from '@/components/analytics/TopToursChart';
import { ActivityFeed } from '@/components/analytics/ActivityFeed';
import { QuickActions } from '@/components/analytics/QuickActions';
import { DistributionPieChart } from '@/components/analytics/DistributionPieChart';
import { NotificationsWidget } from '@/components/analytics/NotificationsWidget';
import { EmailActivityWidget } from '@/components/analytics/EmailActivityWidget';
import { CommentsWidget } from '@/components/analytics/CommentsWidget';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Eye, Heart, MessageSquare, TrendingUp, Bell, Mail } from 'lucide-react';
import { useEnhancedAnalytics } from '@/hooks/useEnhancedAnalytics';

const Inicio = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { analytics, loading } = useEnhancedAnalytics();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
  }, [user, navigate]);

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

        {/* Stats Cards Grid - 6 cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-12">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-12">
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
              subtitle={`${analytics.unreadComments} ${t('inicio.unread')}`}
              icon={<MessageSquare className="w-6 h-6" />}
              badge={analytics.unreadComments}
              color="pink"
            />
            <StatsCard
              title={t('inicio.notifications')}
              value={analytics.totalNotifications}
              subtitle={`${analytics.unreadNotifications} ${t('inicio.unread')}`}
              icon={<Bell className="w-6 h-6" />}
              badge={analytics.unreadNotifications}
              color="orange"
            />
            <StatsCard
              title={t('inicio.emailsSent')}
              value={analytics.totalEmailsSent}
              subtitle={`${analytics.emailSuccessRate}% ${t('inicio.successRate')}`}
              icon={<Mail className="w-6 h-6" />}
              trend={analytics.emailsToday > 0 ? `+${analytics.emailsToday} ${t('inicio.today')}` : undefined}
              color="green"
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

        {/* Widgets Row: Notifications, Comments, Email Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <NotificationsWidget />
          <CommentsWidget />
          <EmailActivityWidget />
        </div>

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
