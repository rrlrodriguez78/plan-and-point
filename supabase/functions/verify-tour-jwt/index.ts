import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const jwtSecret = Deno.env.get("JWT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod validation schema
const VerifyJWTSchema = z.object({
  jwt: z.string().min(1, { message: 'JWT token is required' })
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate request body with Zod
    const validation = VerifyJWTSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          valid: false,
          details: validation.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { jwt: jwtToken } = validation.data;

    // Verify JWT signature and expiration
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    let payload;
    try {
      payload = await verify(jwtToken, key);
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or expired token', 
          valid: false,
          reason: 'signature_verification_failed'
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get share record from database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: share, error: shareError } = await supabase
      .from('tour_shares')
      .select('*, virtual_tours(id, title, is_published)')
      .eq('share_token', jwtToken)
      .eq('is_active', true)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ 
          error: 'Share link not found or deactivated', 
          valid: false,
          reason: 'share_not_found'
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Additional validations
    const now = new Date();

    // Check expiration from database (double-check)
    if (share.expires_at && new Date(share.expires_at) < now) {
      return new Response(
        JSON.stringify({ 
          error: 'Share link has expired', 
          valid: false,
          reason: 'expired'
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max views
    if (share.max_views && share.view_count >= share.max_views) {
      return new Response(
        JSON.stringify({ 
          error: 'Share link has reached maximum views', 
          valid: false,
          reason: 'max_views_exceeded'
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment view count
    const { error: updateError } = await supabase
      .from('tour_shares')
      .update({ view_count: share.view_count + 1 })
      .eq('id', share.id);

    if (updateError) {
      console.error('Error incrementing view count:', updateError);
    }

    // Return validated data
    return new Response(
      JSON.stringify({ 
        valid: true,
        tour_id: (payload as any).tourId,
        permissions: (payload as any).permissions,
        tour: share.virtual_tours,
        share_id: share.id,
        view_count: share.view_count + 1
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in verify-tour-jwt:", error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request', valid: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
