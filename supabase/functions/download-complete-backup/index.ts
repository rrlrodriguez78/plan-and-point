import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupData {
  tenant: any;
  tours: any[];
  media_files: string[];
  statistics: any;
}

const CHUNK_SIZE = 512 * 1024; // 512KB chunks
const BATCH_SIZE = 10; // Process 10 images at a time

// Background processing function
async function processBackupInBackground(
  backupId: string,
  uploadToken: string,
  userId: string,
  supabaseAdmin: any,
  supabase: any
) {
  try {
    console.log(`[BACKGROUND] Starting processing for backup ${backupId}`);
    
    const { data: backup, error: backupError } = await supabaseAdmin
      .from('tour_backups')
      .select('*')
      .eq('id', backupId)
      .eq('user_id', userId)
      .single();

    if (backupError || !backup) {
      throw new Error('Backup not found in background task');
    }

    const backupData = backup.backup_data as BackupData;
    const mediaFiles = backupData.media_files || [];

    console.log(`[BACKGROUND] Processing ${mediaFiles.length} media files`);

    let chunkNumber = 0;
    let currentChunk = '';
    let totalBytesProcessed = 0;
    let imagesProcessed = 0;

    const uploadCurrentChunk = async () => {
      if (!currentChunk) return;
      
      chunkNumber++;
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(currentChunk)
      );
      const hashHex = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { error: chunkError } = await supabase.rpc('upload_backup_chunk', {
        p_upload_token: uploadToken,
        p_chunk_number: chunkNumber,
        p_chunk_data: currentChunk,
        p_chunk_hash: hashHex
      });

      if (chunkError) {
        throw new Error(`Failed to upload chunk ${chunkNumber}: ${chunkError.message}`);
      }

      console.log(`[BACKGROUND] Uploaded chunk ${chunkNumber} (${currentChunk.length} bytes)`);
      currentChunk = '';
    };

    // Start with base JSON
    const baseBackup = {
      version: '1.0',
      backup_id: backup.id,
      backup_name: backup.backup_name,
      created_at: backup.created_at,
      backup_data: backupData,
      images: [] as any[],
      statistics: {
        total_images: mediaFiles.length,
        total_size_bytes: 0,
        total_size_mb: '0.00'
      }
    };

    let completeJson = JSON.stringify(baseBackup);
    
    // Upload base JSON in chunks
    for (let i = 0; i < completeJson.length; i += CHUNK_SIZE) {
      currentChunk = completeJson.substring(i, i + CHUNK_SIZE);
      await uploadCurrentChunk();
    }

    // Process images in batches
    for (let i = 0; i < mediaFiles.length; i += BATCH_SIZE) {
      const batch = mediaFiles.slice(i, i + BATCH_SIZE);
      
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
            console.error(`[BACKGROUND] Failed to download ${filePath}:`, downloadError);
            continue;
          }

          const arrayBuffer = await fileData.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64Data = encodeBase64(uint8Array);
          
          const imageJson = JSON.stringify({
            path: filePath,
            data: base64Data,
            contentType: fileData.type || 'image/jpeg',
            size: uint8Array.length
          });

          if (currentChunk.length + imageJson.length > CHUNK_SIZE) {
            await uploadCurrentChunk();
          }
          
          currentChunk += (currentChunk ? ',' : '') + imageJson;
          totalBytesProcessed += uint8Array.length;
          imagesProcessed++;

          console.log(`[BACKGROUND] Processed ${imagesProcessed}/${mediaFiles.length}: ${filePath}`);

        } catch (err) {
          console.error(`[BACKGROUND] Error processing ${url}:`, err);
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < mediaFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Upload any remaining chunk
    if (currentChunk) {
      await uploadCurrentChunk();
    }

    console.log(`[BACKGROUND] Upload completed: ${imagesProcessed} images, ${(totalBytesProcessed / (1024 * 1024)).toFixed(2)} MB`);

    // Mark upload as completed
    await supabaseAdmin
      .from('large_backup_upload')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('upload_token', uploadToken);

    // Log success
    await supabaseAdmin.from('backup_logs').insert({
      backup_id: backupId,
      user_id: userId,
      action: 'complete_download_chunked',
      details: {
        status: 'success',
        images_processed: imagesProcessed,
        total_chunks: chunkNumber,
        total_size_mb: (totalBytesProcessed / (1024 * 1024)).toFixed(2)
      }
    });

    // Update backup format
    await supabaseAdmin
      .from('tour_backups')
      .update({ backup_format: 'complete-zip' })
      .eq('id', backupId);

    console.log(`[BACKGROUND] Task completed successfully`);

  } catch (error) {
    console.error('[BACKGROUND] Error:', error);
    
    // Mark upload as failed
    await supabaseAdmin
      .from('large_backup_upload')
      .update({ status: 'failed' })
      .eq('upload_token', uploadToken);
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
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // User client for RPC operations (to ensure auth.uid() works)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { backup_id } = await req.json();
    if (!backup_id) {
      throw new Error('backup_id is required');
    }

    console.log('Downloading complete backup:', backup_id);

    // Get backup data (use admin client for fetching)
    const { data: backup, error: backupError } = await supabaseAdmin
      .from('tour_backups')
      .select('*')
      .eq('id', backup_id)
      .eq('user_id', user.id)
      .single();

    if (backupError || !backup) {
      throw new Error('Backup not found or access denied');
    }

    const backupData = backup.backup_data as BackupData;
    const mediaFiles = backupData.media_files || [];

    console.log(`Initializing chunked download for ${mediaFiles.length} media files`);

    // Generate upload token
    const uploadToken = `download_${backup_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate estimated total size
    const baseJson = JSON.stringify({
      version: '1.0',
      backup_id: backup.id,
      backup_name: backup.backup_name,
      created_at: backup.created_at,
      backup_data: backupData
    });
    const estimatedTotalSize = baseJson.length + (mediaFiles.length * 800 * 1024); // Estimate 800KB per image
    const totalChunks = Math.ceil(estimatedTotalSize / CHUNK_SIZE);

    console.log(`Estimated size: ${(estimatedTotalSize / (1024 * 1024)).toFixed(2)} MB, chunks: ${totalChunks}`);

    // Initialize chunked upload (use user client for RPC to ensure auth.uid() works)
    const { data: uploadId, error: uploadError } = await supabase.rpc('start_large_backup_upload', {
      p_upload_token: uploadToken,
      p_total_chunks: totalChunks,
      p_chunk_size: CHUNK_SIZE,
      p_total_size: estimatedTotalSize,
      p_backup_name: backup.backup_name,
      p_description: `Complete backup with ${mediaFiles.length} images`,
      p_device_info: { source: 'edge_function', type: 'download' }
    });

    if (uploadError) {
      console.error('Upload initialization error:', uploadError);
      throw new Error(`Failed to initialize upload: ${uploadError.message}`);
    }

    console.log(`Upload initialized: ${uploadToken}, ID: ${uploadId}`);

    // Start background processing immediately
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(
        processBackupInBackground(backup_id, uploadToken, user.id, supabaseAdmin, supabase)
      );
      console.log('Background processing started');
    } else {
      // Fallback for local development - start async but don't wait
      processBackupInBackground(backup_id, uploadToken, user.id, supabaseAdmin, supabase)
        .catch(err => console.error('Background task error:', err));
    }

    // Return immediately with upload token
    return new Response(
      JSON.stringify({
        success: true,
        upload_token: uploadToken,
        upload_id: uploadId,
        total_chunks_estimated: totalChunks,
        total_images: mediaFiles.length,
        estimated_size_mb: (estimatedTotalSize / (1024 * 1024)).toFixed(2),
        message: 'Background processing started. Use get_upload_progress to monitor.'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in download-complete-backup:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});