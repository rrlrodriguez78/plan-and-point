import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== 🔐 set-tour-password invoked ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request - returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📋 Checking authorization header...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('✅ Authorization header present');

    console.log('📖 Reading request body...');
    const { tour_id, password, enabled } = await req.json();
    console.log('📦 Request data:', { tour_id, enabled, has_password: !!password });

    if (!tour_id) {
      console.error('❌ Missing tour_id');
      return new Response(
        JSON.stringify({ error: 'tour_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔑 Creating Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    console.log('👤 Getting user from auth...');
    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 Token extracted, getting user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      console.error('❌ Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!user) {
      console.error('❌ No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('✅ User authenticated:', user.id);

    console.log('🔍 Fetching tour...');
    const { data: tour, error: tourError } = await supabaseClient
      .from('virtual_tours')
      .select('organization_id')
      .eq('id', tour_id)
      .single();

    if (tourError || !tour) {
      console.error('❌ Error fetching tour:', tourError);
      return new Response(
        JSON.stringify({ error: 'Tour not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Tour data:', tour);

    // Create admin client for ownership verification and updates
    console.log('🔧 Creating admin client...');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Fetching organization owner...');
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('owner_id')
      .eq('id', tour.organization_id)
      .single();

    if (orgError || !org) {
      console.error('❌ Error fetching organization:', orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 Organization owner:', org.owner_id);

    if (org.owner_id !== user.id) {
      console.error('❌ User is not owner. Owner:', org.owner_id, 'User:', user.id);
      return new Response(
        JSON.stringify({ error: 'You are not the owner of this tour' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('✅ Ownership verified');

    let updateData: any = { password_protected: enabled };
    console.log('📝 Preparing update data:', { enabled });

    if (enabled && password) {
      if (password.length < 6) {
        console.error('❌ Password too short');
        return new Response(
          JSON.stringify({ error: 'Password must be at least 6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('🔐 Hashing password with SHA-256...');
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      updateData.password_hash = hash;
      console.log('✅ Password hashed');
    } else if (!enabled) {
      console.log('🔓 Removing password protection');
      updateData.password_hash = null;
    }

    console.log('💾 Updating tour in database...');
    const { error: updateError } = await supabaseAdmin
      .from('virtual_tours')
      .update(updateData)
      .eq('id', tour_id);

    if (updateError) {
      console.error('❌ Error updating tour:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update tour password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Tour updated successfully');
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Unexpected error in set-tour-password:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});