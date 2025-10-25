import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Starting weekly reports generation...');

    // Get all users who have email_weekly_report enabled
    const { data: users, error: usersError } = await supabase
      .from('notification_settings')
      .select(`
        user_id,
        email_weekly_report,
        profiles!inner(email, full_name)
      `)
      .eq('email_weekly_report', true);

    if (usersError) throw usersError;

    console.log(`Found ${users?.length || 0} users with weekly reports enabled`);

    const results = [];

    for (const user of users || []) {
      try {
        // Calculate date range for last week
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);

        // Get analytics for the user's tours in the last week
        const { data: analytics, error: analyticsError } = await supabase
          .from('analytics_summary')
          .select(`
            tour_id,
            total_views,
            unique_viewers,
            virtual_tours!inner(title, organization_id)
          `)
          .gte('date', lastWeek.toISOString().split('T')[0])
          .lte('date', today.toISOString().split('T')[0]);

        if (analyticsError) {
          console.error(`Error fetching analytics for user ${user.user_id}:`, analyticsError);
          continue;
        }

        // Aggregate stats
        const totalViews = analytics?.reduce((sum, a) => sum + (a.total_views || 0), 0) || 0;
        const uniqueVisitors = analytics?.reduce((sum, a) => sum + (a.unique_viewers || 0), 0) || 0;

        // Get top 3 tours
        const tourStats = analytics?.reduce((acc: any, a) => {
          if (!acc[a.tour_id]) {
            acc[a.tour_id] = {
              tour_id: a.tour_id,
              title: (a.virtual_tours as any).title,
              views: 0
            };
          }
          acc[a.tour_id].views += a.total_views || 0;
          return acc;
        }, {});

        const topTours = Object.values(tourStats || {})
          .sort((a: any, b: any) => b.views - a.views)
          .slice(0, 3);

        // Skip if no activity this week
        if (totalViews === 0) {
          console.log(`No activity for user ${user.user_id}, skipping...`);
          continue;
        }

        // Send weekly report email
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-notification-email',
          {
            body: {
              notification_type: 'weekly_report',
              recipient_email: (user.profiles as any).email,
              recipient_name: (user.profiles as any).full_name || 'Usuario',
              data: {
                user_id: user.user_id,
                stats: {
                  total_views: totalViews,
                  unique_visitors: uniqueVisitors,
                  top_tours: topTours
                }
              }
            }
          }
        );

        if (emailError) {
          console.error(`Error sending email to user ${user.user_id}:`, emailError);
          results.push({ user_id: user.user_id, success: false, error: emailError.message });
        } else {
          console.log(`Successfully sent weekly report to ${(user.profiles as any).email}`);
          results.push({ user_id: user.user_id, success: true });
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing user ${user.user_id}:`, error);
        results.push({ user_id: user.user_id, success: false, error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in send-weekly-reports:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
