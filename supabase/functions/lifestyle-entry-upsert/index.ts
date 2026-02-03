// Deploy commands:
// supabase functions deploy lifestyle-entry-upsert
// supabase secrets set DATA_ENCRYPTION_KEY_V1=<your-key>
// supabase secrets set SUPABASE_DB_URL=postgresql://postgres:[password]@[host]:[port]/postgres

/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';
import { encryptFieldV1, decryptFieldMaybe } from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface LifestyleEntryInput {
  date: string; // YYYY-MM-DD format
  notes?: string | null;
  dream_description?: string | null;
  meals?: string | null;
  dream_quality?: number | null;
  alcohol_consumption?: number | null;
  mood?: string | null;
  sickness_level?: number | null;
  exercise_type?: string | null;
  exercise_duration?: number | null;
  sexual_appetite?: number | null;
  sexual_performance?: number | null;
  energy_level?: number | null;
  room_temperature?: number | null;
  mood_set_at?: string | null;
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

    // Parse request body (defensive): handle empty body and invalid JSON
    const rawBody = await req.text();
    let body: LifestyleEntryInput;
    try {
      body = (rawBody && rawBody.trim().length > 0)
        ? (JSON.parse(rawBody) as LifestyleEntryInput)
        : ({} as LifestyleEntryInput);
    } catch (_e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate required fields
    if (!body.date || typeof body.date !== 'string') {
      return new Response(
        JSON.stringify({ error: 'date is required and must be a string (YYYY-MM-DD)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.date)) {
      return new Response(
        JSON.stringify({ error: 'date must be in YYYY-MM-DD format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Prepare data for upsert
    // Encrypt sensitive text fields: notes, dream_description, meals
    const encryptedData: any = {
      user_id: user.id,
      date: body.date,
    };

    // Encrypt text fields if provided (empty/null stays null)
    if (body.notes !== undefined) {
      encryptedData.notes = body.notes ? await encryptFieldV1(body.notes) : null;
    }
    if (body.dream_description !== undefined) {
      encryptedData.dream_description = body.dream_description ? await encryptFieldV1(body.dream_description) : null;
    }
    if (body.meals !== undefined) {
      encryptedData.meals = body.meals ? await encryptFieldV1(body.meals) : null;
    }

    // Copy other fields as-is (non-encrypted)
    if (body.dream_quality !== undefined) encryptedData.dream_quality = body.dream_quality;
    if (body.alcohol_consumption !== undefined) encryptedData.alcohol_consumption = body.alcohol_consumption;
    if (body.mood !== undefined) encryptedData.mood = body.mood;
    if (body.sickness_level !== undefined) encryptedData.sickness_level = body.sickness_level;
    if (body.exercise_type !== undefined) encryptedData.exercise_type = body.exercise_type;
    if (body.exercise_duration !== undefined) encryptedData.exercise_duration = body.exercise_duration;
    if (body.sexual_appetite !== undefined) encryptedData.sexual_appetite = body.sexual_appetite;
    if (body.sexual_performance !== undefined) encryptedData.sexual_performance = body.sexual_performance;
    if (body.energy_level !== undefined) encryptedData.energy_level = body.energy_level;
    if (body.room_temperature !== undefined) encryptedData.room_temperature = body.room_temperature;
    if (body.mood_set_at !== undefined) encryptedData.mood_set_at = body.mood_set_at;

    // Upsert using unique constraint (user_id, date)
    const { data: result, error: upsertError } = await supabaseClient
      .from('lifestyle_entries')
      .upsert(encryptedData, {
        onConflict: 'user_id,date',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (upsertError) {
      throw new Error(`Failed to upsert lifestyle entry: ${upsertError.message}`);
    }

    // Decrypt sensitive fields before returning
    const decryptedResult: LifestyleEntryOutput = {
      ...result,
      notes: result.notes ? await decryptFieldMaybe(result.notes) : null,
      dream_description: result.dream_description ? await decryptFieldMaybe(result.dream_description) : null,
      meals: result.meals ? await decryptFieldMaybe(result.meals) : null,
    };

    return new Response(JSON.stringify({ entry: decryptedResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in lifestyle-entry-upsert:', error);
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
