// Deploy commands:
// supabase functions deploy lifestyle-entry-list
// supabase secrets set DATA_ENCRYPTION_KEY_V1=<your-key>
// supabase secrets set SUPABASE_DB_URL=postgresql://postgres:[password]@[host]:[port]/postgres

/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';
import { decryptFieldMaybe } from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ListRequest {
  from?: string; // ISO date string
  to?: string; // ISO date string
  limit?: number;
}

interface LifestyleEntryOutput {
  id: string;
  user_id: string;
  date: string;
  notes: string | null;
  dream_description: string | null;
  meals: string | null;
  dream_quality: number | null;
  alcohol_consumption: number | null;
  mood: string | null;
  sickness_level: number | null;
  exercise_type: string | null;
  exercise_duration: number | null;
  sexual_appetite: number | null;
  sexual_performance: number | null;
  energy_level: number | null;
  room_temperature: number | null;
  mood_set_at: string | null;
  created_at: string;
  updated_at: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body: ListRequest = await req.json().catch(() => ({}));

    // Build query
    let query = supabaseClient
      .from('lifestyle_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    // Apply date range filters if provided
    if (body.from) {
      query = query.gte('date', body.from);
    }
    if (body.to) {
      query = query.lte('date', body.to);
    }

    // Apply limit if provided
    if (body.limit && body.limit > 0) {
      query = query.limit(Math.min(body.limit, 1000)); // Cap at 1000
    }

    const { data: entries, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Failed to query lifestyle entries: ${queryError.message}`);
    }

    // Decrypt sensitive fields for each entry
    const decryptedEntries: LifestyleEntryOutput[] = await Promise.all(
      (entries || []).map(async (entry) => ({
        ...entry,
        notes: entry.notes ? await decryptFieldMaybe(entry.notes) : null,
        dream_description: entry.dream_description ? await decryptFieldMaybe(entry.dream_description) : null,
        meals: entry.meals ? await decryptFieldMaybe(entry.meals) : null,
      }))
    );

    return new Response(JSON.stringify({ entries: decryptedEntries }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in lifestyle-entry-list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
