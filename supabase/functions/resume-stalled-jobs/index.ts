import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Checking for stalled sync jobs...');

    // Find jobs stuck in processing for more than 5 minutes
    // ARREGLADO: Usar created_at en lugar de updated_at (que no existe en la tabla)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stalledJobs, error: fetchError } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('status', 'processing')
      .lt('created_at', fiveMinutesAgo);

    if (fetchError) {
      console.error('Error fetching stalled jobs:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${stalledJobs?.length || 0} stalled jobs`);

    if (!stalledJobs || stalledJobs.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No stalled jobs found',
          resumedCount: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let resumedCount = 0;
    let failedToResumeCount = 0;

    for (const job of stalledJobs) {
      console.log(`📦 Attempting to resume job ${job.id} - ${job.processed_items}/${job.total_items} processed`);

      // If job has been retried too many times (3+), mark as failed
      const retryCount = (job.error_messages as any[])?.length || 0;
      if (retryCount >= 3) {
        console.log(`❌ Job ${job.id} exceeded max retries, marking as failed`);
        
        await supabase
          .from('sync_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_messages: [
              ...(job.error_messages || []),
              { error: 'Job exceeded maximum retry attempts', timestamp: new Date().toISOString() }
            ]
          })
          .eq('id', job.id);

        failedToResumeCount++;
        continue;
      }

      // Resume the job by calling batch-sync-photos with resume action
      try {
        const { data: resumeData, error: resumeError } = await supabase.functions.invoke(
          'batch-sync-photos',
          {
            body: {
              action: 'resume_job',
              jobId: job.id
            }
          }
        );

        if (resumeError) {
          console.error(`Failed to resume job ${job.id}:`, resumeError);
          
          // Add error to job history
          await supabase
            .from('sync_jobs')
            .update({
              error_messages: [
                ...(job.error_messages || []),
                { 
                  error: `Resume attempt failed: ${resumeError.message}`, 
                  timestamp: new Date().toISOString() 
                }
              ]
            })
            .eq('id', job.id);

          failedToResumeCount++;
        } else {
          console.log(`✅ Successfully resumed job ${job.id}`);
          resumedCount++;
        }
      } catch (error: any) {
        console.error(`Exception resuming job ${job.id}:`, error);
        failedToResumeCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Resume operation completed',
        totalStalled: stalledJobs.length,
        resumedCount,
        failedToResumeCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in resume-stalled-jobs:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
