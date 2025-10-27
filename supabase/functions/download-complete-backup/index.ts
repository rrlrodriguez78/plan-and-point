import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CHUNK_SIZE = 512 * 1024;
const BATCH_SIZE = 10;

interface ProcessingState {
  upload_token: string;
  backup_id: string;
  user_id: string;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  total_chunks: number;
  processed_chunks: number;
  total_images: number;
  processed_images: number;
  started_at: string;
  last_activity: string;
  estimated_size_mb: number;
  current_operation?: string;
  error_message?: string;
}

async function createPersistentBackgroundJob(
  backupId: string,
  userId: string,
  supabaseAdmin: any
): Promise<string> {
  const uploadToken = `persistent_${backupId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const initialState: ProcessingState = {
    upload_token: uploadToken,
    backup_id: backupId,
    user_id: userId,
    status: 'processing',
    progress: 0,
    total_chunks: 0,
    processed_chunks: 0,
    total_images: 0,
    processed_images: 0,
    started_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    estimated_size_mb: 0,
    current_operation: 'initializing'
  };

  await supabaseAdmin
    .from('background_backup_jobs')
    .insert(initialState);

  return uploadToken;
}

async function updateJobProgress(
  uploadToken: string,
  updates: Partial<ProcessingState>,
  supabaseAdmin: any
) {
  await supabaseAdmin
    .from('background_backup_jobs')
    .update({
      ...updates,
      last_activity: new Date().toISOString()
    })
    .eq('upload_token', uploadToken);
}

async function persistentBackupProcessing(
  backupId: string,
  uploadToken: string,
  userId: string,
  supabaseAdmin: any,
  supabase: any
) {
  try {
    console.log(`[PERSISTENT] Starting persistent processing for backup: ${backupId}`);
    
    await updateJobProgress(uploadToken, {
      current_operation: 'fetching_backup_data',
      progress: 5
    }, supabaseAdmin);

    const { data: backup } = await supabaseAdmin
      .from('tour_backups')
      .select('*')
      .eq('id', backupId)
      .single();

    if (!backup) {
      throw new Error('Backup no encontrado');
    }

    const backupData = backup.backup_data;
    const mediaFiles = backupData.media_files || [];

    await updateJobProgress(uploadToken, {
      total_images: mediaFiles.length,
      current_operation: 'preparing_data',
      progress: 10
    }, supabaseAdmin);

    const baseBackup = {
      version: '2.0',
      backup_id: backup.id,
      backup_name: backup.backup_name,
      created_at: backup.created_at,
      backup_data: backupData,
      images: [] as any[]
    };

    let chunkNumber = 0;
    let currentChunk = '';

    let completeJson = JSON.stringify(baseBackup);
    const estimatedTotalSize = completeJson.length + (mediaFiles.length * 800 * 1024);
    
    await updateJobProgress(uploadToken, {
      estimated_size_mb: Math.round(estimatedTotalSize / (1024 * 1024)),
      total_chunks: Math.ceil(estimatedTotalSize / CHUNK_SIZE),
      current_operation: 'processing_json',
      progress: 15
    }, supabaseAdmin);

    for (let i = 0; i < completeJson.length; i += CHUNK_SIZE) {
      currentChunk = completeJson.substring(i, i + CHUNK_SIZE);
      chunkNumber++;
      
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(currentChunk));
      const hashHex = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      await supabase.rpc('upload_backup_chunk', {
        p_upload_token: uploadToken,
        p_chunk_number: chunkNumber,
        p_chunk_data: currentChunk,
        p_chunk_hash: hashHex
      });

      await updateJobProgress(uploadToken, {
        processed_chunks: chunkNumber,
        progress: 15 + Math.round((chunkNumber / Math.ceil(completeJson.length / CHUNK_SIZE)) * 20)
      }, supabaseAdmin);
    }

    await updateJobProgress(uploadToken, {
      current_operation: 'processing_images',
      progress: 35
    }, supabaseAdmin);

    for (let i = 0; i < mediaFiles.length; i += BATCH_SIZE) {
      const batch = mediaFiles.slice(i, i + BATCH_SIZE);
      
      await updateJobProgress(uploadToken, {
        current_operation: `processing_images_batch_${Math.floor(i/BATCH_SIZE) + 1}`,
        processed_images: i
      }, supabaseAdmin);

      for (const url of batch) {
        try {
          const urlObj = new URL(url);
          const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/tour-images\/(.+)/);
          if (!pathMatch) continue;
          
          const filePath = pathMatch[1];
          
          const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('tour-images')
            .download(filePath);

          if (downloadError) {
            console.warn(`[PERSISTENT] Failed to download ${filePath}:`, downloadError);
            continue;
          }

          const arrayBuffer = await fileData.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64Data = encodeBase64(uint8Array);
          
          const imageJson = JSON.stringify({
            path: filePath,
            data: base64Data,
            contentType: fileData.type || 'image/jpeg',
            size: uint8Array.length,
            original_url: url
          });

          if (currentChunk.length + imageJson.length > CHUNK_SIZE) {
            chunkNumber++;
            
            const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(currentChunk));
            const hashHex = Array.from(new Uint8Array(hash))
              .map(b => b.toString(16).padStart(2, '0')).join('');

            await supabase.rpc('upload_backup_chunk', {
              p_upload_token: uploadToken,
              p_chunk_number: chunkNumber,
              p_chunk_data: currentChunk,
              p_chunk_hash: hashHex
            });

            currentChunk = '';
          }
          
          currentChunk += (currentChunk ? ',' : '') + imageJson;

        } catch (err) {
          console.error(`[PERSISTENT] Error processing ${url}:`, err);
        }
      }

      const imageProgress = 35 + Math.round((i / mediaFiles.length) * 60);
      await updateJobProgress(uploadToken, {
        processed_images: i + batch.length,
        progress: imageProgress
      }, supabaseAdmin);

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (currentChunk) {
      chunkNumber++;
      
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(currentChunk));
      const hashHex = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      await supabase.rpc('upload_backup_chunk', {
        p_upload_token: uploadToken,
        p_chunk_number: chunkNumber,
        p_chunk_data: currentChunk,
        p_chunk_hash: hashHex
      });
    }

    await updateJobProgress(uploadToken, {
      status: 'completed',
      progress: 100,
      processed_chunks: chunkNumber,
      processed_images: mediaFiles.length,
      current_operation: 'finalizing',
      last_activity: new Date().toISOString()
    }, supabaseAdmin);

    console.log(`[PERSISTENT] Backup processing completed: ${chunkNumber} chunks, ${mediaFiles.length} images`);

  } catch (error) {
    console.error('[PERSISTENT] Processing error:', error);
    
    await updateJobProgress(uploadToken, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      last_activity: new Date().toISOString()
    }, supabaseAdmin);
  }
}

async function resumePendingJobs(supabaseAdmin: any, supabase: any) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckJobs } = await supabaseAdmin
      .from('background_backup_jobs')
      .select('*')
      .eq('status', 'processing')
      .lt('last_activity', fiveMinutesAgo);

    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`[RESUME] Found ${stuckJobs.length} stuck jobs, marking as failed`);
      
      for (const job of stuckJobs) {
        await updateJobProgress(job.upload_token, {
          status: 'failed',
          error_message: 'Job stuck and auto-failed by system',
          last_activity: new Date().toISOString()
        }, supabaseAdmin);
      }
    }
  } catch (error) {
    console.error('[RESUME] Error checking stuck jobs:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    const requestData = await req.json();
    const { backup_id, action = 'start', upload_token } = requestData;

    if (action === 'start') {
      if (!backup_id) {
        throw new Error('Backup ID is required');
      }

      const { data: existingJob } = await supabaseAdmin
        .from('background_backup_jobs')
        .select('*')
        .eq('backup_id', backup_id)
        .eq('user_id', user.id)
        .in('status', ['processing', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingJob) {
        if (existingJob.status === 'completed') {
          return new Response(
            JSON.stringify({
              success: true,
              upload_token: existingJob.upload_token,
              status: 'completed',
              existing_job: true,
              message: 'Job already completed'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (existingJob.status === 'processing') {
          return new Response(
            JSON.stringify({
              success: true,
              upload_token: existingJob.upload_token,
              status: 'processing',
              existing_job: true,
              message: 'Job already in progress'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const uploadToken = await createPersistentBackgroundJob(backup_id, user.id, supabaseAdmin);

      // @ts-ignore - EdgeRuntime is available in Deno Deploy
      EdgeRuntime.waitUntil(
        persistentBackupProcessing(backup_id, uploadToken, user.id, supabaseAdmin, supabase)
      );

      // @ts-ignore
      EdgeRuntime.waitUntil(resumePendingJobs(supabaseAdmin, supabase));

      return new Response(
        JSON.stringify({
          success: true,
          upload_token: uploadToken,
          status: 'processing',
          message: 'Persistent background processing started'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'status') {
      if (!upload_token) {
        throw new Error('Upload token is required for status check');
      }

      const { data: job } = await supabaseAdmin
        .from('background_backup_jobs')
        .select('*')
        .eq('upload_token', upload_token)
        .eq('user_id', user.id)
        .single();

      if (!job) {
        throw new Error('Job not found');
      }

      return new Response(
        JSON.stringify({
          success: true,
          job: job,
          message: `Job status: ${job.status}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'cancel') {
      if (!upload_token) {
        throw new Error('Upload token is required for cancellation');
      }

      await updateJobProgress(upload_token, {
        status: 'cancelled',
        error_message: 'Cancelled by user',
        last_activity: new Date().toISOString()
      }, supabaseAdmin);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Job cancelled successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('[EDGE FUNCTION] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
