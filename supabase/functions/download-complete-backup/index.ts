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

    console.log(`Processing ${mediaFiles.length} media files with chunked approach`);

    // Generate upload token
    const uploadToken = `download_${backup_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create base backup structure (without images yet)
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

    // Convert base structure to JSON
    let completeJson = JSON.stringify(baseBackup);
    
    // Calculate estimated total size
    const estimatedTotalSize = completeJson.length + (mediaFiles.length * 800 * 1024); // Estimate 800KB per image
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

    // Process images in batches and upload as chunks
    let chunkNumber = 0;
    let currentChunk = '';
    let totalBytesProcessed = 0;
    let imagesProcessed = 0;

    // Helper to upload current chunk
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

      console.log(`Uploaded chunk ${chunkNumber} (${currentChunk.length} bytes)`);
      currentChunk = '';
    };

    // Start with base JSON (split into chunks if needed)
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
            console.error(`Failed to download ${filePath}:`, downloadError);
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

          // Add to current chunk or start new one if too large
          if (currentChunk.length + imageJson.length > CHUNK_SIZE) {
            await uploadCurrentChunk();
          }
          
          currentChunk += (currentChunk ? ',' : '') + imageJson;
          totalBytesProcessed += uint8Array.length;
          imagesProcessed++;

          console.log(`Processed ${imagesProcessed}/${mediaFiles.length}: ${filePath} (${uint8Array.length} bytes)`);

        } catch (err) {
          console.error(`Error processing ${url}:`, err);
        }
      }

      // Small delay between batches to avoid overwhelming memory
      if (i + BATCH_SIZE < mediaFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Upload any remaining chunk
    if (currentChunk) {
      await uploadCurrentChunk();
    }

    console.log(`Upload completed: ${imagesProcessed} images, ${(totalBytesProcessed / (1024 * 1024)).toFixed(2)} MB`);

    // Log the download (use admin client for logging)
    await supabaseAdmin.from('backup_logs').insert({
      backup_id: backup.id,
      user_id: user.id,
      action: 'complete_download_chunked',
      details: {
        status: 'success',
        images_processed: imagesProcessed,
        total_chunks: chunkNumber,
        total_size_mb: (totalBytesProcessed / (1024 * 1024)).toFixed(2)
      }
    });

    // Update backup format (use admin client)
    await supabaseAdmin
      .from('tour_backups')
      .update({ backup_format: 'complete-zip' })
      .eq('id', backup_id);

    // Return upload token and progress info
    return new Response(
      JSON.stringify({
        success: true,
        upload_token: uploadToken,
        total_chunks: chunkNumber,
        images_processed: imagesProcessed,
        total_size_mb: (totalBytesProcessed / (1024 * 1024)).toFixed(2),
        message: 'Backup prepared successfully. Use upload_token to retrieve data.'
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