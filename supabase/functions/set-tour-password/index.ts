import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Check if password has been compromised using Have I Been Pwned API
async function isPasswordCompromised(password: string): Promise<boolean> {
  try {
    // Generate SHA-1 hash of password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    // Use k-anonymity model: send only first 5 chars
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    
    // Query Have I Been Pwned API
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'VirtualTours-PasswordCheck',
      },
    });
    
    if (!response.ok) {
      console.error('HIBP API error:', response.status);
      return false; // Don't block on API failure
    }
    
    const text = await response.text();
    // Check if hash suffix appears in response
    return text.includes(suffix);
  } catch (error) {
    console.error('Error checking password breach:', error);
    return false; // Don't block on error
  }
}

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
      // Server-side password validation - same requirements as user passwords
      if (password.length < 12) {
        console.error('Password validation failed: too short');
        return new Response(
          JSON.stringify({ error: 'Password must be at least 12 characters' }),
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
      if (!/[A-Z]/.test(password)) {
        console.error('Password validation failed: no uppercase');
        return new Response(
          JSON.stringify({ error: 'Password must include at least one uppercase letter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!/[a-z]/.test(password)) {
        console.error('Password validation failed: no lowercase');
        return new Response(
          JSON.stringify({ error: 'Password must include at least one lowercase letter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!/[0-9]/.test(password)) {
        console.error('Password validation failed: no number');
        return new Response(
          JSON.stringify({ error: 'Password must include at least one number' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        console.error('Password validation failed: no special character');
        return new Response(
          JSON.stringify({ error: 'Password must include at least one special character' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if password has been compromised in data breaches
      const isCompromised = await isPasswordCompromised(password);
      if (isCompromised) {
        console.error('Password validation failed: compromised in data breach');
        return new Response(
          JSON.stringify({ 
            error: 'This password has been exposed in a data breach. Please choose a different password.' 
          }),
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
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
