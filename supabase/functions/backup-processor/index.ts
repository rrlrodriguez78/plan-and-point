import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ============================================================
// VALIDACIÓN DE ENTRADA CON ZOD
// ============================================================

const startBackupSchema = z.object({
  action: z.literal('start'),
  tourId: z.string().uuid({ message: "Tour ID debe ser un UUID válido" }),
  backupType: z.enum(['full_backup', 'media_only']).default('full_backup'),
});

const statusBackupSchema = z.object({
  action: z.literal('status'),
  backupId: z.string().uuid({ message: "Backup ID debe ser un UUID válido" }),
});

const requestSchema = z.discriminatedUnion('action', [
  startBackupSchema,
  statusBackupSchema,
]);

// ============================================================
// SERVIDOR PRINCIPAL
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse y validar request body
    const rawBody = await req.json();
    const validatedBody = requestSchema.parse(rawBody);
    
    // Crear cliente Supabase con service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { 
        global: { 
          headers: { Authorization: req.headers.get('Authorization')! } 
        } 
      }
    );

    // Verificar autenticación
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BACKUP] Acción: ${validatedBody.action}, Usuario: ${user.id}`);

    // Router de acciones
    if (validatedBody.action === 'start') {
      return await startBackup(
        validatedBody.tourId, 
        validatedBody.backupType, 
        user.id, 
        supabaseClient
      );
    } else {
      return await getBackupStatus(
        validatedBody.backupId, 
        user.id, 
        supabaseClient
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[BACKUP] Error:', errorMessage);
    
    // Manejar errores de validación de Zod
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: 'Datos de entrada inválidos',
          details: error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================
// INICIAR BACKUP
// ============================================================

async function startBackup(
  tourId: string, 
  backupType: string, 
  userId: string, 
  supabase: any
) {
  console.log(`[BACKUP] Iniciando ${backupType} para tour: ${tourId}`);

  // 1. Obtener tenant del usuario
  const { data: tenantMembership, error: tenantError } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .single();

  if (tenantError || !tenantMembership) {
    throw new Error('Usuario no pertenece a ningún tenant');
  }

  const tenantId = tenantMembership.tenant_id;

  // 2. Verificar que el tour existe y pertenece al tenant del usuario
  const { data: tour, error: tourError } = await supabase
    .from('virtual_tours')
    .select(`
      id,
      title,
      description,
      tenant_id,
      floor_plans (
        id,
        name,
        image_url
      ),
      hotspots:floor_plans (
        hotspots (
          id,
          title,
          x_position,
          y_position
        )
      ),
      panorama_photos:floor_plans (
        hotspots (
          panorama_photos (
            id,
            photo_url,
            photo_url_mobile,
            photo_url_thumbnail
          )
        )
      )
    `)
    .eq('id', tourId)
    .eq('tenant_id', tenantId)
    .single();

  if (tourError || !tour) {
    throw new Error('Tour no encontrado o no tienes permisos');
  }

  // 3. Calcular total de items
  const totalItems = calculateTotalItems(tour, backupType);

  // 4. Crear job de backup
  const { data: backupJob, error: jobError } = await supabase
    .from('backup_jobs')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      tour_id: tourId,
      job_type: backupType,
      status: 'processing',
      total_items: totalItems,
      processed_items: 0,
      progress_percentage: 0,
      metadata: {
        tour_title: tour.title,
        started_at: new Date().toISOString(),
      }
    })
    .select()
    .single();

  if (jobError) {
    console.error('[BACKUP] Error creando job:', jobError);
    throw new Error(`Error creando job de backup: ${jobError.message}`);
  }

  console.log(`[BACKUP] Job creado: ${backupJob.id}`);

  // 5. Iniciar procesamiento en segundo plano (no esperar)
  processBackup(tour, backupJob.id, backupType, supabase).catch(err => {
    console.error(`[BACKUP] Error en procesamiento en segundo plano:`, err);
  });

  return new Response(
    JSON.stringify({
      success: true,
      backupId: backupJob.id,
      backupType,
      status: 'processing',
      totalItems,
      tourName: tour.title,
      message: 'Backup iniciado correctamente. Puedes consultar el progreso con la acción "status".'
    }),
    { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// ============================================================
// OBTENER ESTADO DEL BACKUP
// ============================================================

async function getBackupStatus(
  backupId: string, 
  userId: string, 
  supabase: any
) {
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
    .eq('user_id', userId)
    .single();

  if (error || !backupJob) {
    throw new Error('Backup no encontrado o no tienes permisos');
  }

  const progress = backupJob.progress_percentage || 
    (backupJob.total_items > 0 
      ? Math.round((backupJob.processed_items / backupJob.total_items) * 100)
      : 0);

  return new Response(
    JSON.stringify({
      backupId: backupJob.id,
      tourId: backupJob.tour_id,
      tourName: backupJob.virtual_tours?.title || 'Tour desconocido',
      jobType: backupJob.job_type,
      status: backupJob.status,
      downloadUrl: backupJob.file_url,
      fileSize: backupJob.file_size,
      progress,
      processedItems: backupJob.processed_items,
      totalItems: backupJob.total_items,
      createdAt: backupJob.created_at,
      completedAt: backupJob.completed_at,
      error: backupJob.error_message,
      metadata: backupJob.metadata,
    }),
    { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// ============================================================
// CALCULAR TOTAL DE ITEMS
// ============================================================

function calculateTotalItems(tour: any, backupType: string): number {
  let totalFloorPlans = 0;
  let totalHotspots = 0;
  let totalPanoramas = 0;

  if (tour.floor_plans && Array.isArray(tour.floor_plans)) {
    totalFloorPlans = tour.floor_plans.length;
    
    // Contar hotspots
    tour.floor_plans.forEach((fp: any) => {
      if (fp.hotspots && Array.isArray(fp.hotspots)) {
        totalHotspots += fp.hotspots.length;
        
        // Contar panoramas
        fp.hotspots.forEach((h: any) => {
          if (h.panorama_photos && Array.isArray(h.panorama_photos)) {
            totalPanoramas += h.panorama_photos.length;
          }
        });
      }
    });
  }

  if (backupType === 'media_only') {
    // Solo imágenes: floor plans + panoramas
    return totalFloorPlans + totalPanoramas;
  }
  
  // full_backup: todo + metadata del tour
  return 1 + totalFloorPlans + totalHotspots + totalPanoramas;
}

// ============================================================
// PROCESAR BACKUP (EJECUTA EN SEGUNDO PLANO)
// ============================================================

async function processBackup(
  tour: any, 
  backupJobId: string, 
  backupType: string, 
  supabase: any
) {
  try {
    console.log(`[BACKUP] Procesando ${backupType} para tour: ${tour.title}`);
    
    // TODO: Aquí irá la lógica real de procesamiento
    // Por ahora simulamos el procesamiento con un delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const totalItems = calculateTotalItems(tour, backupType);

    // Marcar como completado
    await supabase
      .from('backup_jobs')
      .update({
        status: 'completed',
        processed_items: totalItems,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          tour_title: tour.title,
          completed_at: new Date().toISOString(),
          processing_time_ms: 2000, // TODO: calcular tiempo real
        }
      })
      .eq('id', backupJobId);

    console.log(`[BACKUP] Completado: ${backupJobId}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido en procesamiento';
    console.error(`[BACKUP] Error en backup ${backupJobId}:`, errorMessage);
    
    await supabase
      .from('backup_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', backupJobId);
  }
}
