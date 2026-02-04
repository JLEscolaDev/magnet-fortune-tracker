/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { baseCorsHeaders, jsonResponse, parseJsonBody, requireUser, getAccessTier } from '../_shared/report-utils.ts';

const corsHeaders = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ReportListRequest {
  year?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const { supabaseClient, user } = await requireUser(req);
    const { allowedReportTypes } = await getAccessTier(supabaseClient, user.id);

    if (allowedReportTypes.length === 0) {
      return jsonResponse({ error: 'Subscription required' }, 403, corsHeaders);
    }

    let body: ReportListRequest = {};
    try {
      body = await parseJsonBody<ReportListRequest>(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON body';
      return jsonResponse({ error: message }, 400, corsHeaders);
    }

    const year = body.year ?? new Date().getUTCFullYear();
    if (!Number.isInteger(year)) {
      return jsonResponse({ error: 'year must be an integer' }, 400, corsHeaders);
    }

    const { data: reports, error: queryError } = await supabaseClient
      .from('reports')
      .select('id, report_type, period_start, period_end, title, status, created_at, updated_at, year')
      .eq('user_id', user.id)
      .eq('year', year)
      .order('period_start', { ascending: true });

    if (queryError) {
      throw new Error(`Failed to list reports: ${queryError.message}`);
    }

    return jsonResponse({ reports: reports ?? [] }, 200, corsHeaders);
  } catch (error) {
    console.error('Error in report-list:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Authorization required' || message === 'Invalid or expired token' ? 401 : 500;
    return jsonResponse({ error: message }, status, corsHeaders);
  }
});
