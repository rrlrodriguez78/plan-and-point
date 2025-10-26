import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tour_id, password, enabled } = await req.json();

    if (!tour_id) {
      console.error('Missing tour_id');
      return new Response(
        JSON.stringify({ error: 'tour_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    // Security: Do not log tokens or user credentials
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      console.error('Authentication failed');
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!user) {
      console.error('Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: tour, error: tourError } = await supabaseClient
      .from('virtual_tours')
      .select('tenant_id')
      .eq('id', tour_id)
      .single();

    if (tourError || !tour) {
      console.error('Tour not found');
      return new Response(
        JSON.stringify({ error: 'Tour not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for ownership verification and updates
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('owner_id')
      .eq('id', tour.tenant_id)
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant not found');
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tenant.owner_id !== user.id) {
      console.error('Unauthorized: User does not own tour');
      return new Response(
        JSON.stringify({ error: 'You are not the owner of this tour' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updateData: any = { password_protected: enabled };

    if (enabled && password) {
      // Server-side password validation
      if (password.length < 8) {
        console.error('Password validation failed: too short');
        return new Response(
          JSON.stringify({ error: 'Password must be at least 8 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (password.length > 128) {
        console.error('Password validation failed: too long');
        return new Response(
          JSON.stringify({ error: 'Password must be less than 128 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Security: Do not log password data
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      updateData.password_hash = hash;
    } else if (!enabled) {
      updateData.password_hash = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from('virtual_tours')
      .update(updateData)
      .eq('id', tour_id);

    if (updateError) {
      console.error('Database update failed');
      return new Response(
        JSON.stringify({ error: 'Failed to update tour password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in set-tour-password');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
