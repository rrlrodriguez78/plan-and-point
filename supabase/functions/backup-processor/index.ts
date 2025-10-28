import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

console.log('🚀 Backup processor function started');

serve(async (req) => {
  console.log('📨 Request received:', req.method, req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const requestBody = await req.text();
    console.log('📦 Request body:', requestBody);
    
    const { action, tourId, backupType = 'full_backup', backupId } = JSON.parse(requestBody);
    console.log('🔍 Parsed request:', { action, tourId, backupType, backupId });

    // Validate required fields
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key (bypasses JWT verification)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔧 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // For JWT verification, we would use the auth header, but we're using service role for now
    const authHeader = req.headers.get('Authorization');
    console.log('🔑 Auth header present:', !!authHeader);

    if (action === 'start') {
      if (!tourId) {
        return new Response(
          JSON.stringify({ error: 'Tour ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await startBackup(tourId, backupType, supabaseClient);
    } else if (action === 'status') {
      if (!backupId) {
        return new Response(
          JSON.stringify({ error: 'Backup ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await getBackupStatus(backupId, supabaseClient);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('💥 Error in backup processor:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function startBackup(tourId: string, backupType: string, supabase: any) {
  console.log('🎬 Starting backup for tour:', tourId, 'type:', backupType);

  try {
    // Verify tour exists
    const { data: tour, error: tourError } = await supabase
      .from('virtual_tours')
      .select(`
        *,
        floor_plans (
          *,
          hotspots (
            *,
            panorama_photos (*)
          )
        )
      `)
      .eq('id', tourId)
      .maybeSingle();

    if (tourError) {
      console.error('❌ Tour query error:', tourError);
      throw new Error(`Tour not found: ${tourError.message}`);
    }

    if (!tour) {
      throw new Error('Tour not found');
    }

    console.log('✅ Tour found:', tour.title);

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, owner_id')
      .eq('id', tour.tenant_id)
      .maybeSingle();

    if (tenantError) {
      console.error('❌ Tenant query error:', tenantError);
      throw new Error(`Tenant not found: ${tenantError.message}`);
    }

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    console.log('✅ Tenant found:', tenant.id, 'Owner:', tenant.owner_id);

    // Calculate total items
    const totalItems = calculateTotalItems(tour, backupType);
    console.log('📊 Total items to process:', totalItems);

    // Create backup job
    const { data: backupJob, error: jobError } = await supabase
      .from('backup_jobs')
      .insert({
        tour_id: tourId,
        job_type: backupType,
        status: 'processing',
        total_items: totalItems,
        user_id: tenant.owner_id,
        tenant_id: tenant.id
      })
      .select()
      .maybeSingle();

    if (jobError) {
      console.error('❌ Backup job creation error:', jobError);
      throw new Error(`Error creating backup job: ${jobError.message}`);
    }

    console.log('✅ Backup job created:', backupJob.id);

    // Start background processing (don't wait)
    processBackup(tour, backupJob.id, backupType, supabase);

    return new Response(
      JSON.stringify({
        success: true,
        backupId: backupJob.id,
        backupType,
        status: 'processing',
        totalItems,
        tourName: tour.title
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Error in startBackup:', error);
    throw error;
  }
}

async function getBackupStatus(backupId: string, supabase: any) {
  console.log('📊 Getting backup status for:', backupId);

  try {
    const { data: backupJob, error } = await supabase
      .from('backup_jobs')
      .select(`
        *,
        virtual_tours (
          id,
          title
        )
      `)
      .eq('id', backupId)
      .maybeSingle();

    if (error) {
      console.error('❌ Backup status query error:', error);
      throw new Error(`Backup not found: ${error.message}`);
    }

    if (!backupJob) {
      throw new Error('Backup not found');
    }

    const progress = backupJob.total_items > 0 
      ? Math.round((backupJob.processed_items / backupJob.total_items) * 100)
      : 0;

    const response = {
      backupId: backupJob.id,
      tourId: backupJob.tour_id,
      tourName: backupJob.virtual_tours?.title || 'Unknown Tour',
      jobType: backupJob.job_type,
      status: backupJob.status,
      downloadUrl: backupJob.file_url,
      fileSize: backupJob.file_size,
      progress,
      processedItems: backupJob.processed_items,
      totalItems: backupJob.total_items,
      createdAt: backupJob.created_at,
      completedAt: backupJob.completed_at,
      error: backupJob.error_message
    };

    console.log('✅ Backup status:', response);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Error in getBackupStatus:', error);
    throw error;
  }
}

function calculateTotalItems(tour: any, backupType: string): number {
  const floorPlansCount = tour.floor_plans?.length || 0;
  
  // Count all hotspots across all floor plans
  let hotspotsCount = 0;
  let photosCount = 0;
  
  tour.floor_plans?.forEach((floorPlan: any) => {
    hotspotsCount += floorPlan.hotspots?.length || 0;
    
    // Count all photos across all hotspots
    floorPlan.hotspots?.forEach((hotspot: any) => {
      photosCount += hotspot.panorama_photos?.length || 0;
    });
  });

  if (backupType === 'media_only') {
    return photosCount + floorPlansCount;
  }
  
  // full_backup includes everything + 1 for metadata
  return photosCount + floorPlansCount + hotspotsCount + 1;
}

async function processBackup(tour: any, backupJobId: string, backupType: string, supabase: any) {
  try {
    console.log(`🔄 Processing ${backupType} backup for: ${tour.title}, job: ${backupJobId}`);
    
    // Simulate processing for now
    let processedItems = 0;
    const totalItems = calculateTotalItems(tour, backupType);
    
    // Update progress in chunks
    const updateProgress = async (count: number) => {
      processedItems = count;
      const progress = Math.round((processedItems / totalItems) * 100);
      
      await supabase
        .from('backup_jobs')
        .update({
          processed_items: processedItems,
          progress_percentage: progress
        })
        .eq('id', backupJobId);
      
      console.log(`📈 Progress update: ${progress}% (${processedItems}/${totalItems})`);
    };

    // Simulate processing steps
    await updateProgress(1); // Starting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await updateProgress(Math.floor(totalItems * 0.3)); // 30%
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await updateProgress(Math.floor(totalItems * 0.7)); // 70%
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await updateProgress(totalItems); // 100%

    // Mark as completed
    await supabase
      .from('backup_jobs')
      .update({
        status: 'completed',
        processed_items: totalItems,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        file_url: `https://example.com/backup-${backupJobId}.zip`, // Simulated URL
        file_size: 1024 * 1024 // Simulated 1MB file
      })
      .eq('id', backupJobId);

    console.log(`✅ Backup completed: ${backupJobId}`);

  } catch (error) {
    console.error(`💥 Error in backup ${backupJobId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await supabase
      .from('backup_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', backupJobId);
  }
}
