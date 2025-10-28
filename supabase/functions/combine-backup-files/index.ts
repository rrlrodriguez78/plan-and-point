import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { partIds, backupIds } = await req.json();

    if (!partIds || partIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No parts selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Combining ${partIds.length} backup files into single ZIP`);

    // Get backup parts information
    const { data: parts, error: partsError } = await supabase
      .from('backup_parts')
      .select('id, backup_job_id, part_number, storage_path, file_size')
      .in('id', partIds);

    if (partsError) throw partsError;

    if (!parts || parts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid parts found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a new ZIP
    const zip = new JSZip();

    // Download and add each file to the ZIP
    for (const part of parts) {
      try {
        console.log(`📥 Downloading part ${part.part_number} from ${part.storage_path}`);
        
        const { data: fileData, error: downloadError } = await supabase
          .storage
          .from('backups')
          .download(part.storage_path);

        if (downloadError) {
          console.error(`❌ Error downloading ${part.storage_path}:`, downloadError);
          continue;
        }

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const fileName = part.storage_path.split('/').pop() || `part_${part.part_number}.zip`;
          zip.file(fileName, arrayBuffer);
          console.log(`✅ Added ${fileName} to combined ZIP`);
        }
      } catch (error) {
        console.error(`Error processing part ${part.id}:`, error);
      }
    }

    // Generate the combined ZIP
    console.log('🔨 Generating combined ZIP file...');
    const zipBlob = await zip.generateAsync({ 
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    // Upload combined ZIP to storage
    const timestamp = Date.now();
    const combinedFileName = `combined/combined_backup_${timestamp}.zip`;

    console.log(`📤 Uploading combined ZIP to storage: ${combinedFileName}`);
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('backups')
      .upload(combinedFileName, new Uint8Array(zipBlob), {
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Create signed URL for download (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('backups')
      .createSignedUrl(combinedFileName, 3600);

    if (signedUrlError) throw signedUrlError;

    console.log('✅ Combined ZIP ready for download');

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: signedUrlData.signedUrl,
        fileName: combinedFileName,
        filesIncluded: parts.length,
        totalSize: zipBlob.byteLength
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('❌ Error combining backup files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to combine backup files';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
