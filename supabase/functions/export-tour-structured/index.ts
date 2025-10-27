import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper functions
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

function extractPathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.findIndex(part => part === 'object');
    if (bucketIndex !== -1) {
      return pathParts.slice(bucketIndex + 2).join('/');
    }
    return url;
  } catch {
    return url;
  }
}

function generateFloorInfo(floorPlan: any, tourTitle: string): string {
  const today = formatDate(new Date().toISOString());
  const totalPhotos = floorPlan.hotspots.reduce((sum: number, h: any) => 
    sum + (h.panorama_photos?.length || 0), 0
  );
  
  let info = `========================================\n`;
  info += `FLOOR EXPORT: ${floorPlan.name}\n`;
  info += `========================================\n\n`;
  info += `Tour: ${tourTitle}\n`;
  info += `Floor: ${floorPlan.name}\n`;
  info += `Export Date: ${today}\n\n`;
  info += `Total Hotspots: ${floorPlan.hotspots.length}\n`;
  info += `Total 360° Photos: ${totalPhotos}\n\n`;
  info += `========================================\n`;
  info += `HOTSPOTS\n`;
  info += `========================================\n\n`;

  for (const hotspot of floorPlan.hotspots) {
    info += `${hotspot.title}\n`;
    if (hotspot.panorama_photos && hotspot.panorama_photos.length > 0) {
      for (const photo of hotspot.panorama_photos) {
        const date = photo.capture_date ? formatDate(photo.capture_date) : 'sin-fecha';
        info += `  • ${date}\n`;
      }
    }
    info += `\n`;
  }

  return info;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, tour_id, floor_plan_id, export_token } = await req.json();

    // ACTION: ESTIMATE
    if (action === 'estimate') {
      const { data: floorPlans, error } = await supabase
        .from('floor_plans')
        .select(`
          id,
          name,
          hotspots(
            id,
            panorama_photos(id, photo_url)
          )
        `)
        .eq('tour_id', tour_id);

      if (error) throw error;

      const estimates = floorPlans.map((fp: any) => {
        const photoCount = fp.hotspots.reduce((sum: number, h: any) => 
          sum + (h.panorama_photos?.length || 0), 0
        );
        // Estimate 3MB per original photo
        const estimatedSize = photoCount * 3;

        return {
          floor_plan_id: fp.id,
          floor_name: fp.name,
          hotspot_count: fp.hotspots.length,
          photo_count: photoCount,
          estimated_size_mb: estimatedSize
        };
      });

      return new Response(
        JSON.stringify({ floor_plans: estimates }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: EXPORT
    if (action === 'export') {
      const exportToken = crypto.randomUUID();

      // Get floor plan data
      const { data: floorPlan, error: fpError } = await supabase
        .from('floor_plans')
        .select(`
          *,
          virtual_tours!inner(title),
          hotspots(
            id,
            title,
            panorama_photos(photo_url, capture_date, original_filename)
          )
        `)
        .eq('id', floor_plan_id)
        .single();

      if (fpError) throw fpError;

      // Create export job record
      const { error: insertError } = await supabase
        .from('tour_exports')
        .insert({
          export_token: exportToken,
          tour_id,
          user_id: user.id,
          floor_plan_id,
          status: 'processing',
          progress: 0
        });

      if (insertError) throw insertError;

      // Start background processing (don't await)
      processExport(supabase, exportToken, floorPlan, user.id).catch(err => {
        console.error('Background process error:', err);
      });

      return new Response(
        JSON.stringify({
          export_token: exportToken,
          floor_name: floorPlan.name,
          message: 'Export started'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: STATUS
    if (action === 'status') {
      const { data: exportJob, error } = await supabase
        .from('tour_exports')
        .select('*, floor_plans(name)')
        .eq('export_token', export_token)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          export_token: exportJob.export_token,
          floor_plan_id: exportJob.floor_plan_id,
          floor_name: exportJob.floor_plans.name,
          status: exportJob.status,
          progress: exportJob.progress,
          download_url: exportJob.download_url,
          error_message: exportJob.error_message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processExport(
  supabase: any,
  exportToken: string,
  floorPlan: any,
  userId: string
) {
  try {
    const tourTitle = floorPlan.virtual_tours.title;
    const files: { path: string; content: Uint8Array }[] = [];

    // Download floor plan image
    try {
      const floorImagePath = extractPathFromUrl(floorPlan.image_url);
      const { data: floorImageBlob, error: imgError } = await supabase.storage
        .from('tour-images')
        .download(floorImagePath);

      if (!imgError && floorImageBlob) {
        const arrayBuffer = await floorImageBlob.arrayBuffer();
        files.push({
          path: `1_Planos/${sanitizeFilename(floorPlan.name)}.jpg`,
          content: new Uint8Array(arrayBuffer)
        });
      }
    } catch (e) {
      console.error('Error downloading floor image:', e);
    }

    // Process hotspots and photos
    let processedFiles = 1;
    const totalFiles = 1 + floorPlan.hotspots.reduce((sum: number, h: any) => 
      sum + (h.panorama_photos?.length || 0), 0
    );

    for (const hotspot of floorPlan.hotspots) {
      if (!hotspot.panorama_photos) continue;

      for (const photo of hotspot.panorama_photos) {
        try {
          const photoPath = extractPathFromUrl(photo.photo_url);
          const { data: photoBlob, error: photoError } = await supabase.storage
            .from('tour-images')
            .download(photoPath);

          if (!photoError && photoBlob) {
            const captureDate = photo.capture_date 
              ? formatDate(photo.capture_date)
              : 'sin-fecha';
            
            const filename = `${sanitizeFilename(hotspot.title)}_${captureDate}.jpg`;
            const hotspotFolder = `2_Fotos_360/${sanitizeFilename(hotspot.title)}`;

            const arrayBuffer = await photoBlob.arrayBuffer();
            files.push({
              path: `${hotspotFolder}/${filename}`,
              content: new Uint8Array(arrayBuffer)
            });

            processedFiles++;

            // Update progress
            if (processedFiles % 5 === 0 || processedFiles === totalFiles) {
              await supabase
                .from('tour_exports')
                .update({
                  processed_files: processedFiles,
                  total_files: totalFiles,
                  progress: Math.round((processedFiles / totalFiles) * 100)
                })
                .eq('export_token', exportToken);
            }
          }
        } catch (e) {
          console.error('Error downloading photo:', e);
        }
      }
    }

    // Add info file
    const infoContent = generateFloorInfo(floorPlan, tourTitle);
    files.push({
      path: 'floor_info.txt',
      content: new TextEncoder().encode(infoContent)
    });

    // Create ZIP using JSZip from npm
    const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
    const zip = new JSZip();

    for (const file of files) {
      zip.file(file.path, file.content);
    }

    const zipBlob = await zip.generateAsync({ type: 'uint8array' });
    const zipSize = zipBlob.length / (1024 * 1024); // MB

    // Upload to storage
    const zipFilename = `${sanitizeFilename(tourTitle)}_${sanitizeFilename(floorPlan.name)}.zip`;
    const storagePath = `exports/${userId}/${exportToken}/${zipFilename}`;

    await supabase.storage
      .from('tour-images')
      .upload(storagePath, zipBlob, {
        contentType: 'application/zip',
        upsert: false
      });

    // Create signed URL
    const { data: signedData } = await supabase.storage
      .from('tour-images')
      .createSignedUrl(storagePath, 86400); // 24 hours

    // Update export as completed
    await supabase
      .from('tour_exports')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        zip_storage_path: storagePath,
        download_url: signedData.signedUrl,
        progress: 100,
        processed_files: totalFiles,
        total_files: totalFiles,
        export_size_mb: zipSize.toFixed(2)
      })
      .eq('export_token', exportToken);

  } catch (error: any) {
    console.error('Process export error:', error);
    
    await supabase
      .from('tour_exports')
      .update({
        status: 'failed',
        error_message: error.message
      })
      .eq('export_token', exportToken);
  }
}
