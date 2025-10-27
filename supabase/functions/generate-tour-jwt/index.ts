import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const jwtSecret = Deno.env.get("JWT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod validation schema
const GenerateJWTSchema = z.object({
  tour_id: z.string().uuid({ message: 'Invalid tour_id format' }),
  permission_level: z.enum(['view', 'comment', 'edit'], { errorMap: () => ({ message: 'Invalid permission level' }) }).optional().default('view'),
  expires_in_days: z.number().int().min(1).max(365, { message: 'Expiration must be between 1 and 365 days' }).optional().default(7),
  max_views: z.number().int().positive({ message: 'Max views must be a positive number' }).optional()
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    
    // Validate request body with Zod
    const validation = GenerateJWTSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: validation.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tour_id, permission_level, expires_in_days, max_views } = validation.data;

    // Verify user owns the tour
    const { data: tour, error: tourError } = await supabase
      .from('virtual_tours')
      .select('tenant_id, tenants!inner(owner_id)')
      .eq('id', tour_id)
      .single();

    if (tourError || !tour) {
      return new Response(
        JSON.stringify({ error: 'Tour not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isOwner = (tour.tenants as any).owner_id === user.id;
    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You do not own this tour' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate JWT
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (expires_in_days * 24 * 60 * 60);

    const payload = {
      tourId: tour_id,
      permissions: [permission_level],
      maxViews: max_views || null,
      viewCount: 0,
      iat: now,
      exp: exp,
    };

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const jwt = await create({ alg: "HS256", typ: "JWT" }, payload, key);

    // Store in tour_shares table
    const expiresAt = new Date(exp * 1000).toISOString();
    
    const { data: shareData, error: shareError } = await supabase
      .from('tour_shares')
      .insert({
        tour_id: tour_id,
        share_token: jwt,
        created_by: user.id,
        permission_level: permission_level,
        expires_at: expiresAt,
        max_views: max_views || null,
      })
      .select()
      .single();

    if (shareError) {
      console.error('Error creating share record:', shareError);
      return new Response(
        JSON.stringify({ error: 'Failed to create share record' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        jwt,
        share_id: shareData.id,
        expires_at: expiresAt,
        share_url: `${req.headers.get('origin') || 'https://your-app.lovable.app'}/share/${jwt}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in generate-tour-jwt:", error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
