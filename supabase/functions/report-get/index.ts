/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { baseCorsHeaders, jsonResponse, parseJsonBody, requireUser, getAccessTier } from '../_shared/report-utils.ts';
import { decryptFieldMaybe } from '../_shared/crypto.ts';

const corsHeaders = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ReportGetRequest {
  report_id?: string;
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

    let body: ReportGetRequest = {};
    try {
      body = await parseJsonBody<ReportGetRequest>(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON body';
      return jsonResponse({ error: message }, 400, corsHeaders);
    }

    const reportId = body.report_id;
    if (!reportId || typeof reportId !== 'string') {
      return jsonResponse({ error: 'report_id is required' }, 400, corsHeaders);
    }

    const { data: report, error: queryError } = await supabaseClient
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (queryError) {
      throw new Error(`Failed to fetch report: ${queryError.message}`);
    }

    if (!report) {
      return jsonResponse({ error: 'Report not found' }, 404, corsHeaders);
    }

    const decryptedContent = report.content ? await decryptFieldMaybe(report.content) : '';

    return jsonResponse({ report: { ...report, content: decryptedContent } }, 200, corsHeaders);
  } catch (error) {
    console.error('Error in report-get:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Authorization required' || message === 'Invalid or expired token' ? 401 : 500;
    return jsonResponse({ error: message }, status, corsHeaders);
  }
});
