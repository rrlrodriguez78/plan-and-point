import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TourBackupConfig {
  id: string;
  tour_id: string;
  tenant_id: string;
  destination_id: string;
  auto_backup_enabled: boolean;
  backup_type: 'full_backup' | 'media_only';
  backup_frequency: 'immediate' | 'daily' | 'weekly';
  last_auto_backup_at: string | null;
  virtual_tours: {
    id: string;
    title: string;
    updated_at: string;
  };
  backup_destinations: {
    id: string;
    cloud_provider: string;
    is_active: boolean;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Auto-backup scheduler running...');

    // 1. Fetch all configs with auto_backup_enabled
    const { data: configs, error: configsError } = await supabase
      .from('tour_backup_config')
      .select(`
        *,
        virtual_tours (id, title, updated_at),
        backup_destinations (id, cloud_provider, is_active)
      `)
      .eq('auto_backup_enabled', true);

    if (configsError) {
      console.error('❌ Error fetching configs:', configsError);
      throw configsError;
    }

    if (!configs || configs.length === 0) {
      console.log('ℹ️ No tours with auto-backup enabled');
      return new Response(
        JSON.stringify({ success: true, message: 'No tours with auto-backup enabled', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${configs.length} tours with auto-backup enabled`);

    let processedCount = 0;
    let skippedCount = 0;
    const results = [];

    // 2. Check each config to see if it needs backup
    for (const config of configs as TourBackupConfig[]) {
      try {
        // Check if destination is active
        if (!config.backup_destinations?.is_active) {
          console.log(`⚠️ Skipping tour ${config.tour_id}: destination not active`);
          skippedCount++;
          continue;
        }

        // Check if needs backup based on frequency
        const needsBackup = checkIfNeedsBackup(config);

        if (!needsBackup) {
          console.log(`⏭️ Skipping tour ${config.virtual_tours?.title}: backup not due yet`);
          skippedCount++;
          continue;
        }

        console.log(`✅ Tour ${config.virtual_tours?.title} needs backup`);

        // 3. Create backup job
        const { data: backupJob, error: jobError } = await supabase
          .from('backup_jobs')
          .insert({
            tour_id: config.tour_id,
            tenant_id: config.tenant_id,
            user_id: (await supabase.auth.admin.getUserById('00000000-0000-0000-0000-000000000000')).data?.user?.id || null,
            destination_id: config.destination_id,
            job_type: config.backup_type,
            destination_type: 'cloud_drive',
            status: 'pending',
          })
          .select()
          .single();

        if (jobError) {
          console.error(`❌ Error creating backup job for tour ${config.tour_id}:`, jobError);
          results.push({ tour_id: config.tour_id, success: false, error: jobError.message });
          continue;
        }

        console.log(`📦 Created backup job ${backupJob.id} for tour ${config.tour_id}`);

        // 4. Add to backup queue
        const { error: queueError } = await supabase
          .from('backup_queue')
          .insert({
            backup_job_id: backupJob.id,
            status: 'pending',
            priority: 2,
            scheduled_at: new Date().toISOString(),
          });

        if (queueError) {
          console.error(`❌ Error adding to queue:`, queueError);
          results.push({ tour_id: config.tour_id, success: false, error: queueError.message });
          continue;
        }

        // 5. Update last_auto_backup_at
        const { error: updateError } = await supabase
          .from('tour_backup_config')
          .update({ last_auto_backup_at: new Date().toISOString() })
          .eq('id', config.id);

        if (updateError) {
          console.warn(`⚠️ Error updating last_auto_backup_at:`, updateError);
        }

        processedCount++;
        results.push({ 
          tour_id: config.tour_id, 
          tour_title: config.virtual_tours?.title,
          backup_job_id: backupJob.id,
          success: true 
        });

        console.log(`✅ Successfully queued backup for tour ${config.virtual_tours?.title}`);

      } catch (error) {
        console.error(`❌ Error processing config ${config.id}:`, error);
        results.push({ 
          tour_id: config.tour_id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    console.log(`✅ Auto-backup scheduler completed: ${processedCount} processed, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        total: configs.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error in auto-backup scheduler:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function checkIfNeedsBackup(config: TourBackupConfig): boolean {
  // Immediate frequency always needs backup (will be triggered by DB triggers)
  if (config.backup_frequency === 'immediate') {
    return false; // Handled by triggers, not scheduler
  }

  // If never backed up, needs backup
  if (!config.last_auto_backup_at) {
    return true;
  }

  const lastBackup = new Date(config.last_auto_backup_at);
  const now = new Date();
  const hoursSince = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);

  // Daily: backup if 24 hours passed
  if (config.backup_frequency === 'daily' && hoursSince >= 24) {
    return true;
  }

  // Weekly: backup if 168 hours (7 days) passed
  if (config.backup_frequency === 'weekly' && hoursSince >= 168) {
    return true;
  }

  return false;
}
