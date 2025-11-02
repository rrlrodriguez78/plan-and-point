import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption helper functions
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('CLOUD_ENCRYPTION_KEY');
  if (!keyString) {
    throw new Error('CLOUD_ENCRYPTION_KEY not configured');
  }
  const keyData = new TextEncoder().encode(keyString.padEnd(32).substring(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decryptToken(encryptedToken: string): Promise<string> {
  const key = await getEncryptionKey();
  const encryptedData = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// MEJORADA: Helper to check if file exists and is accessible in Google Drive
async function fileExistsInDrive(accessToken: string, fileId: string): Promise<{exists: boolean, accessible: boolean, error?: string}> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,trashed,parents,mimeType,size`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return { exists: false, accessible: false, error: 'not_found' };
      } else if (response.status === 403) {
        return { exists: true, accessible: false, error: 'no_access' };
      } else if (response.status === 401) {
        return { exists: true, accessible: false, error: 'auth_required' };
      } else {
        return { exists: true, accessible: false, error: `http_${response.status}` };
      }
    }
    
    const data = await response.json();
    
    // Si está en papelera, considerarlo como no accesible
    if (data.trashed === true) {
      return { exists: true, accessible: false, error: 'trashed' };
    }
    
    return { exists: true, accessible: true };
  } catch (error) {
    console.error(`❌ Error checking file ${fileId}:`, error);
    return { exists: false, accessible: false, error: 'network_error' };
  }
}

// NUEVA: Función para verificar si el folder padre existe
async function verifyDriveFolder(accessToken: string, folderId: string): Promise<{exists: boolean, accessible: boolean}> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,trashed`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      return { exists: false, accessible: false };
    }
    
    const data = await response.json();
    
    // Verificar que sea un folder y no esté en la papelera
    if (data.mimeType !== 'application/vnd.google-apps.folder' || data.trashed === true) {
      return { exists: false, accessible: false };
    }
    
    return { exists: true, accessible: true };
  } catch (error) {
    console.error(`❌ Error checking folder ${folderId}:`, error);
    return { exists: false, accessible: false };
  }
}

// NUEVA: Función para obtener y verificar el folder de destino
async function getVerifiedDestination(supabase: any, tenantId: string) {
  const { data: destination, error: destError } = await supabase
    .from('backup_destinations')
    .select('id, cloud_folder_id, cloud_access_token, cloud_provider')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('cloud_provider', 'google_drive')
    .single();

  if (destError || !destination) {
    throw new Error('No active Google Drive destination found');
  }

  // Decrypt access token
  const accessToken = await decryptToken(destination.cloud_access_token);

  // VERIFICAR QUE EL FOLDER EXISTA
  const folderCheck = await verifyDriveFolder(accessToken, destination.cloud_folder_id);
  if (!folderCheck.exists || !folderCheck.accessible) {
    throw new Error('Google Drive folder not found or inaccessible. Please reconfigure the backup destination.');
  }

  return {
    ...destination,
    accessToken
  };
}

// NUEVA: Función para limpieza completa de mappings huérfanos
async function cleanupOrphanedMappings(supabase: any, tourId: string, accessToken: string) {
  console.log('🧹 Cleaning up orphaned cloud file mappings...');
  
  // Obtener todos los mappings para este tour
  const { data: mappings, error: mappingsError } = await supabase
    .from('cloud_file_mappings')
    .select('id, photo_id, floor_plan_id, cloud_file_id, cloud_file_name')
    .eq('tour_id', tourId);

  if (mappingsError) {
    console.error('Error fetching mappings:', mappingsError);
    return { deleted: 0, errors: [] };
  }

  const orphanedMappings = [];
  const errors = [];

  for (const mapping of mappings || []) {
    try {
      const fileCheck = await fileExistsInDrive(accessToken, mapping.cloud_file_id);
      
      if (!fileCheck.accessible) {
        orphanedMappings.push(mapping.id);
        console.log(`🗑️ Marking orphaned mapping: ${mapping.cloud_file_name || mapping.cloud_file_id} (${fileCheck.error})`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ mappingId: mapping.id, error: errorMsg });
      console.error(`Error checking mapping ${mapping.id}:`, error);
    }
  }

  // Eliminar mappings huérfanos
  if (orphanedMappings.length > 0) {
    const { error: deleteError } = await supabase
      .from('cloud_file_mappings')
      .delete()
      .in('id', orphanedMappings);

    if (deleteError) {
      console.error('Error deleting orphaned mappings:', deleteError);
    } else {
      console.log(`✅ Deleted ${orphanedMappings.length} orphaned mappings`);
    }
  }

  return {
    deleted: orphanedMappings.length,
    errors: errors.length
  };
}

// Background processing function
async function processBatchSync(
  jobId: string,
  tourId: string,
  tenantId: string,
  photosToSync: any[],
  supabase: any
) {
  const results = {
    synced: 0,
    failed: 0,
    errors: [] as { photoId: string; error: string }[]
  };

  for (let i = 0; i < photosToSync.length; i++) {
    const photo = photosToSync[i];
    
    // Check if job was cancelled
    const { data: job } = await supabase
      .from('sync_jobs')
      .select('status')
      .eq('id', jobId)
      .single();
    
    if (job?.status === 'cancelled') {
      console.log(`⛔ Job ${jobId} was cancelled, stopping sync`);
      break;
    }

    console.log(`📤 Processing photo ${i + 1}/${photosToSync.length}: ${photo.id}`);

    let attempts = 0;
    let success = false;
    const maxAttempts = 3;

    while (attempts < maxAttempts && !success) {
      attempts++;
      
      try {
        console.log(`🔄 Syncing photo ${photo.id} (${i + 1}/${photosToSync.length}) - attempt ${attempts}/${maxAttempts}`);

        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          'photo-sync-to-drive',
          {
            body: {
              action: 'sync_photo',
              photoId: photo.id,
              tenantId: tenantId
            }
          }
        );

        if (syncError) {
          throw new Error(syncError.message);
        }

        if (syncResult?.success) {
          results.synced++;
          success = true;
          console.log(`✅ Photo ${photo.id} synced successfully`);
        } else {
          throw new Error(syncResult?.error || 'Unknown sync error');
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`⚠️ Attempt ${attempts} failed for photo ${photo.id}:`, errorMsg);
        
        if (attempts >= maxAttempts) {
          results.failed++;
          results.errors.push({
            photoId: photo.id,
            error: errorMsg
          });
          console.error(`❌ Photo ${photo.id} failed after ${maxAttempts} attempts`);
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }

    // Update progress
    await supabase
      .from('sync_jobs')
      .update({
        processed_items: results.synced + results.failed,
        failed_items: results.failed,
        error_messages: results.errors
      })
      .eq('id', jobId);
  }

  // Mark job as completed or failed
  const finalStatus = results.failed === photosToSync.length ? 'failed' : 'completed';
  await supabase
    .from('sync_jobs')
    .update({
      status: finalStatus,
      processed_items: results.synced + results.failed,
      failed_items: results.failed,
      error_messages: results.errors,
      completed_at: new Date().toISOString()
    })
    .eq('id', jobId);

  console.log(`✅ Background job ${jobId} completed:`, {
    synced: results.synced,
    failed: results.failed,
    total: photosToSync.length
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action, tourId, tenantId, jobId } = body;
    console.log(`📥 Received request - Action: ${action}, JobID: ${jobId}, TourID: ${tourId}`);

    // Handle verify_and_resync action - MEJORADO
    if (action === 'verify_and_resync') {
      console.log('🔍 Verifying Google Drive files and re-syncing missing...');
      
      if (!tourId || !tenantId) {
        return new Response(
          JSON.stringify({ error: 'tourId and tenantId are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Obtener y VERIFICAR destino con la nueva función
      const destination = await getVerifiedDestination(supabase, tenantId);

      // LIMPIEZA: Eliminar mappings huérfanos antes de verificar
      const cleanupResult = await cleanupOrphanedMappings(supabase, tourId, destination.accessToken);
      console.log(`🧹 Cleanup result: ${cleanupResult.deleted} orphaned mappings deleted`);

      // Get all cloud file mappings for this tour (photos AND floor plans) - DESPUÉS de cleanup
      const { data: mappings, error: mappingsError } = await supabase
        .from('cloud_file_mappings')
        .select('id, photo_id, floor_plan_id, cloud_file_id, cloud_file_name')
        .eq('tour_id', tourId);

      if (mappingsError) {
        throw new Error(`Failed to fetch mappings: ${mappingsError.message}`);
      }

      console.log(`📋 Found ${mappings?.length || 0} existing mappings to verify`);

      const missingPhotoIds: string[] = [];
      const missingFloorPlanIds: string[] = [];
      const validMappings: string[] = [];
      const totalMappings = (mappings || []).length;
      let checkedCount = 0;

      // Verify each mapping CON LA NUEVA VERIFICACIÓN MEJORADA
      for (const mapping of mappings || []) {
        checkedCount++;
        console.log(`🔍 Checking file ${checkedCount}/${totalMappings}: ${mapping.cloud_file_name || mapping.cloud_file_id}`);
        
        const fileCheck = await fileExistsInDrive(destination.accessToken, mapping.cloud_file_id);
        
        if (!fileCheck.accessible) {
          console.log(`❌ File not accessible in Drive: ${mapping.cloud_file_name || mapping.cloud_file_id} (${fileCheck.error})`);
          
          // Delete incorrect mapping
          await supabase
            .from('cloud_file_mappings')
            .delete()
            .eq('id', mapping.id);
          
          // Separate by type
          if (mapping.photo_id) {
            missingPhotoIds.push(mapping.photo_id);
          } else if (mapping.floor_plan_id) {
            missingFloorPlanIds.push(mapping.floor_plan_id);
          }
        } else {
          validMappings.push(mapping.id);
          console.log(`✅ File verified: ${mapping.cloud_file_name || mapping.cloud_file_id}`);
        }
      }

      console.log(`✅ Verification complete: ${validMappings.length} valid, ${missingPhotoIds.length} photos missing, ${missingFloorPlanIds.length} floor plans missing`);

      // Re-sync floor plans if any are missing
      if (missingFloorPlanIds.length > 0) {
        console.log(`🗺️ Re-syncing ${missingFloorPlanIds.length} floor plans...`);
        
        const { data: floorPlans } = await supabase
          .from('floor_plans')
          .select('*')
          .in('id', missingFloorPlanIds);
        
        if (floorPlans && floorPlans.length > 0) {
          // Get destination info for floor plan sync
          const { data: dest } = await supabase
            .from('backup_destinations')
            .select('id, cloud_folder_id, cloud_access_token')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .single();

          if (dest) {
            const accessToken = await decryptToken(dest.cloud_access_token);
            
            for (const floorPlan of floorPlans) {
              try {
                const { error: fpSyncError } = await supabase.functions.invoke('photo-sync-to-drive', {
                  body: {
                    action: 'sync_floor_plan',
                    floorPlanId: floorPlan.id,
                    tenantId: tenantId
                  }
                });
                
                if (fpSyncError) {
                  console.error(`Error syncing floor plan ${floorPlan.id}:`, fpSyncError);
                }
              } catch (error) {
                console.error(`Failed to sync floor plan ${floorPlan.id}:`, error);
              }
            }
          }
        }
      }

      // Check if there's nothing to sync
      if (missingPhotoIds.length === 0 && missingFloorPlanIds.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'All files verified successfully',
            verified: validMappings.length,
            missingPhotos: 0,
            missingFloorPlans: 0,
            cleanedUp: cleanupResult.deleted
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let newJob = null;

      // Create sync job only if there are photos to sync
      if (missingPhotoIds.length > 0) {
        // Fetch missing photos to re-sync
        const { data: photosToSync, error: photosError } = await supabase
          .from('panorama_photos')
          .select(`
            id,
            hotspot_id,
            hotspots!inner(
              floor_plan_id,
              floor_plans!inner(
                tour_id
              )
            )
          `)
          .in('id', missingPhotoIds);

        if (photosError) {
          throw new Error(`Failed to fetch missing photos: ${photosError.message}`);
        }

        console.log(`📸 Found ${photosToSync?.length || 0} photos to re-sync`);

        // Create sync job for missing photos
        const { data: job, error: jobError } = await supabase
          .from('sync_jobs')
          .insert({
            tenant_id: tenantId,
            tour_id: tourId,
            job_type: 'photo_batch_sync',
            status: 'processing',
            total_items: photosToSync?.length || 0,
            processed_items: 0,
            failed_items: 0
          })
          .select()
          .single();

        if (jobError || !job) {
          throw new Error('Failed to create sync job');
        }

        newJob = job;
        console.log(`✅ Created re-sync job ${newJob.id} for ${photosToSync?.length || 0} missing photos`);

        // Start background processing
        // @ts-ignore
        if (typeof EdgeRuntime !== 'undefined') {
          // @ts-ignore
          EdgeRuntime.waitUntil(
            processBatchSync(newJob.id, tourId, tenantId, photosToSync || [], supabase)
          );
        }
      }

      const message = [];
      if (missingPhotoIds.length > 0) message.push(`${missingPhotoIds.length} photos`);
      if (missingFloorPlanIds.length > 0) message.push(`${missingFloorPlanIds.length} floor plans`);

      return new Response(
        JSON.stringify({ 
          success: true,
          jobId: newJob?.id,
          verified: validMappings.length,
          missingPhotos: missingPhotoIds.length,
          missingFloorPlans: missingFloorPlanIds.length,
          cleanedUp: cleanupResult.deleted,
          message: `Re-syncing ${message.join(' and ')}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle resume_job action
    if (action === 'resume_job') {
      console.log(`🔄 Resuming stalled job: ${jobId}`);
      
      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'jobId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: existingJob, error: jobError } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !existingJob) {
        console.error('Job not found:', jobError);
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get photos that still need syncing
      const { data: photos } = await supabase
        .from('panorama_photos')
        .select(`
          id,
          hotspot_id,
          hotspots!inner(
            floor_plan_id,
            floor_plans!inner(
              tour_id
            )
          )
        `)
        .eq('hotspots.floor_plans.tour_id', existingJob.tour_id);

      const { data: alreadySynced } = await supabase
        .from('cloud_file_mappings')
        .select('photo_id')
        .in('photo_id', (photos || []).map(p => p.id));

      const syncedIds = new Set((alreadySynced || []).map(m => m.photo_id));
      const photosToSync = (photos || []).filter(p => !syncedIds.has(p.id));

      console.log(`📊 Resume status: ${photosToSync.length} photos remaining`);

      // Reset job status to processing
      await supabase
        .from('sync_jobs')
        .update({ 
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      // Start background processing from remaining photos
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined') {
        // @ts-ignore
        EdgeRuntime.waitUntil(
          processBatchSync(jobId, existingJob.tour_id, existingJob.tenant_id, photosToSync, supabase)
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Job resumed',
          jobId: jobId,
          remainingPhotos: photosToSync.length,
          totalItems: existingJob.total_items
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle get_progress action
    if (action === 'get_progress') {
      // Get job progress
      const { data: job, error: jobError } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Job not found'
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          job
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cancel_job') {
      // Cancel job
      const { error: cancelError } = await supabase
        .from('sync_jobs')
        .update({ 
          status: 'cancelled', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', jobId);

      if (cancelError) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: cancelError.message
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Job cancelled'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default action: start_job
    console.log('🔄 Starting batch photo sync:', { tourId, tenantId });

    // 1. Verificar que existe un destination activo
    const { data: destination, error: destError } = await supabase
      .from('backup_destinations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('cloud_provider', 'google_drive')
      .single();

    if (destError || !destination) {
      throw new Error('No active Google Drive destination found');
    }

    // 2. Obtener todas las fotos del tour que NO están sincronizadas
    console.log(`📸 Fetching photos for tour: ${tourId}`);
    const { data: photos, error: photosError } = await supabase
      .from('panorama_photos')
      .select(`
        id,
        hotspot_id,
        hotspots!inner(
          floor_plan_id,
          floor_plans!inner(
            tour_id
          )
        )
      `)
      .eq('hotspots.floor_plans.tour_id', tourId);

    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    console.log(`Found ${photos?.length || 0} total photos`);

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No photos found for this tour',
          jobId: null,
          totalPhotos: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Filtrar fotos ya sincronizadas
    const photoIds = photos.map(p => p.id);
    const { data: alreadySynced } = await supabase
      .from('cloud_file_mappings')
      .select('photo_id')
      .in('photo_id', photoIds);

    const syncedIds = new Set((alreadySynced || []).map(m => m.photo_id));
    const photosToSync = photos.filter(p => !syncedIds.has(p.id));

    console.log('📊 Sync status:', {
      total: photos.length,
      alreadySynced: syncedIds.size,
      toSync: photosToSync.length
    });

    if (photosToSync.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'All photos already synced',
          jobId: null,
          totalPhotos: photos.length,
          alreadySynced: photos.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Crear job en la base de datos
    const { data: newJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        tenant_id: tenantId,
        tour_id: tourId,
        job_type: 'photo_batch_sync',
        status: 'processing',
        total_items: photosToSync.length,
        processed_items: 0,
        failed_items: 0
      })
      .select()
      .single();

    if (jobError || !newJob) {
      throw new Error('Failed to create sync job');
    }

    console.log(`✅ Created job ${newJob.id} for ${photosToSync.length} photos`);

    // 5. Iniciar procesamiento en background
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(
        processBatchSync(newJob.id, tourId, tenantId, photosToSync, supabase)
      );
    } else {
      // Fallback for local development
      processBatchSync(newJob.id, tourId, tenantId, photosToSync, supabase).catch(err => {
        console.error('Background processing error:', err);
      });
    }

    // 6. Devolver respuesta inmediata con jobId
    return new Response(
      JSON.stringify({ 
        success: true,
        jobId: newJob.id,
        totalPhotos: photosToSync.length,
        alreadySynced: syncedIds.size,
        message: 'Sync job started in background'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Batch sync failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
