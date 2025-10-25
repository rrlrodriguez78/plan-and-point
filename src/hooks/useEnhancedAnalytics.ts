import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EnhancedAnalytics {
  totalTours: number;
  publishedTours: number;
  draftTours: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  unreadComments: number;
  totalNotifications: number;
  unreadNotifications: number;
  totalEmailsSent: number;
  emailSuccessRate: number;
  emailsToday: number;
}

export const useEnhancedAnalytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<EnhancedAnalytics>({
    totalTours: 0,
    publishedTours: 0,
    draftTours: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    unreadComments: 0,
    totalNotifications: 0,
    unreadNotifications: 0,
    totalEmailsSent: 0,
    emailSuccessRate: 0,
    emailsToday: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's organization
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!orgData) {
        setLoading(false);
        return;
      }

      // Get tours
      const { data: tours } = await supabase
        .from('virtual_tours')
        .select('id, is_published')
        .eq('organization_id', orgData.id);

      const totalTours = tours?.length || 0;
      const publishedTours = tours?.filter(t => t.is_published).length || 0;
      const draftTours = totalTours - publishedTours;

      // Get analytics data
      const { data: analyticsData } = await supabase
        .from('tour_analytics')
        .select('views_count, likes_count, comments_count')
        .in('tour_id', tours?.map(t => t.id) || []);

      const totalViews = analyticsData?.reduce((sum, a) => sum + (a.views_count || 0), 0) || 0;
      const totalLikes = analyticsData?.reduce((sum, a) => sum + (a.likes_count || 0), 0) || 0;
      const totalComments = analyticsData?.reduce((sum, a) => sum + (a.comments_count || 0), 0) || 0;

      // Get unread comments
      const { data: comments } = await supabase
        .from('tour_comments')
        .select('id, is_read')
        .in('tour_id', tours?.map(t => t.id) || [])
        .eq('is_read', false);

      const unreadComments = comments?.length || 0;

      // Get notifications
      const { data: notifications } = await supabase
        .from('notifications')
        .select('id, read')
        .eq('user_id', user.id);

      const totalNotifications = notifications?.length || 0;
      const unreadNotifications = notifications?.filter(n => !n.read).length || 0;

      // Get email logs
      const { data: emailLogs } = await supabase
        .from('email_logs')
        .select('status, sent_at')
        .eq('user_id', user.id);

      const totalEmailsSent = emailLogs?.length || 0;
      const successCount = emailLogs?.filter(l => l.status === 'sent').length || 0;
      const emailSuccessRate = totalEmailsSent > 0 ? Math.round((successCount / totalEmailsSent) * 100) : 0;

      // Count emails sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const emailsToday = emailLogs?.filter(l => new Date(l.sent_at) >= today).length || 0;

      setAnalytics({
        totalTours,
        publishedTours,
        draftTours,
        totalViews,
        totalLikes,
        totalComments,
        unreadComments,
        totalNotifications,
        unreadNotifications,
        totalEmailsSent,
        emailSuccessRate,
        emailsToday,
      });
    } catch (error) {
      console.error('Error loading enhanced analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  return {
    analytics,
    loading,
    refresh: loadAnalytics,
  };
};
