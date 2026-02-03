// Deploy commands:
// supabase functions deploy crypto-smoke-test
// supabase secrets set DATA_ENCRYPTION_KEY_V1=<your-key>
// supabase secrets set DATA_ENCRYPTION_KEY_PREV=<previous-key>  (optional)
// supabase secrets set SUPABASE_DB_URL=postgresql://postgres:[password]@[host]:[port]/postgres

/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';
import { decryptText, decryptFieldMaybe } from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SmokeTestResponse {
  ok: boolean;
  mode?: 'fortune' | 'lifestyle';
  fortune_id?: string | null;
  lifestyle_entry_id?: string | null;
  decrypted_preview?: string | null;
  error?: string;
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
        JSON.stringify({ ok: false, fortune_id: null, decrypted_preview: null, error: 'Authorization required' }),
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
        JSON.stringify({ ok: false, error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body to check for mode
    let body: { mode?: 'fortune' | 'lifestyle' } = {};
    try {
      body = await req.json().catch(() => ({}));
    } catch {
      // Body is optional, default to fortune mode
    }

    const mode = body.mode || 'fortune';

    if (mode === 'lifestyle') {
      // Read one lifestyle_entries row owned by the user
      const { data: entry, error: entryError } = await supabaseClient
        .from('lifestyle_entries')
        .select('id, notes')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (entryError) {
        throw new Error(`Failed to fetch lifestyle entry: ${entryError.message}`);
      }

      // If no entries, return success with null values
      if (!entry || !entry.notes) {
        const response: SmokeTestResponse = {
          ok: true,
          mode: 'lifestyle',
          lifestyle_entry_id: null,
          decrypted_preview: null,
        };
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Decrypt notes using decryptFieldMaybe (handles both encrypted and plaintext)
      let decryptedNotes: string;
      try {
        decryptedNotes = await decryptFieldMaybe(entry.notes);
      } catch (decryptError) {
        throw new Error(`Decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`);
      }

      // Return first 20 characters as preview
      const preview = decryptedNotes.substring(0, 20);

      const response: SmokeTestResponse = {
        ok: true,
        mode: 'lifestyle',
        lifestyle_entry_id: entry.id,
        decrypted_preview: preview,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Default: fortune mode
      // Read one fortune row owned by the user
      const { data: fortune, error: fortuneError } = await supabaseClient
        .from('fortunes')
        .select('id, text')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fortuneError) {
        throw new Error(`Failed to fetch fortune: ${fortuneError.message}`);
      }

      // If no fortunes, return success with null values
      if (!fortune || !fortune.text) {
        const response: SmokeTestResponse = {
          ok: true,
          mode: 'fortune',
          fortune_id: null,
          decrypted_preview: null,
        };
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Decrypt text using shared helper
      let decryptedText: string;
      try {
        decryptedText = await decryptText(fortune.text);
      } catch (decryptError) {
        throw new Error(`Decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`);
      }

      // Return first 20 characters as preview
      const preview = decryptedText.substring(0, 20);

      const response: SmokeTestResponse = {
        ok: true,
        mode: 'fortune',
        fortune_id: fortune.id,
        decrypted_preview: preview,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in crypto-smoke-test:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
