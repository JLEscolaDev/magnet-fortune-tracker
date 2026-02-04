/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  baseCorsHeaders,
  jsonResponse,
  parseJsonBody,
  requireUser,
  getAccessTier,
  computeWeeklyPeriod,
  computeQuarterlyPeriod,
  computeAnnualPeriod,
  parseDateOnly,
  addDaysUTC,
  ReportType,
} from '../_shared/report-utils.ts';
import { decryptFieldMaybe, encryptFieldV1 } from '../_shared/crypto.ts';

const corsHeaders = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ReportGenerateRequest {
  report_type?: ReportType;
  year?: number;
  weekStart?: string;
  quarter?: number;
}

type LifestyleEntryRow = {
  date: string;
  mood: string | null;
  notes: string | null;
  dream_description: string | null;
  meals: string | null;
};

const KNOWN_REPORT_TYPES: ReportType[] = ['weekly', 'quarterly', 'annual'];

function buildReportTitle(
  reportType: ReportType,
  periodStart: string,
  periodEnd: string,
  year?: number,
  quarter?: number
) {
  if (reportType === 'weekly') {
    return `Weekly Report (${periodStart} to ${periodEnd})`;
  }
  if (reportType === 'quarterly') {
    return `Quarterly Report (Q${quarter} ${year})`;
  }
  return `Annual Report (${year})`;
}

function stripMoodData(text: string): string {
  return text.replace(/\[MOOD_DATA\][\s\S]*?\[\/MOOD_DATA\]/g, '').trim();
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

function buildReportContent(args: {
  title: string;
  periodStart: string;
  periodEnd: string;
  entryCount: number;
  moodCounts: Record<string, number>;
  notesCount: number;
  dreamsCount: number;
  mealsCount: number;
  fortunesInPeriod: number;
  fortuneTotal: number;
  fortuneToday: number;
  highlights: Array<{ label: string; date: string; text: string }>;
}) {
  const lines: string[] = [];
  lines.push(`# ${args.title}`);
  lines.push(`Period: ${args.periodStart} to ${args.periodEnd}`);
  lines.push('');
  lines.push('Summary');
  lines.push(`- Lifestyle entries: ${args.entryCount}`);
  lines.push(`- Notes with content: ${args.notesCount}`);
  lines.push(`- Dreams with content: ${args.dreamsCount}`);
  lines.push(`- Meals with content: ${args.mealsCount}`);
  lines.push(`- Fortunes created in period: ${args.fortunesInPeriod}`);
  lines.push(`- Total fortunes: ${args.fortuneTotal}`);
  lines.push(`- Fortunes today: ${args.fortuneToday}`);
  lines.push('');
  lines.push('Mood distribution');

  const moodKeys = Object.keys(args.moodCounts).sort();
  if (moodKeys.length === 0) {
    lines.push('- None');
  } else {
    for (const mood of moodKeys) {
      lines.push(`- ${mood}: ${args.moodCounts[mood]}`);
    }
  }

  lines.push('');
  lines.push('Highlights');
  if (args.highlights.length === 0) {
    lines.push('- None');
  } else {
    args.highlights.forEach((item, idx) => {
      lines.push(`${idx + 1}. [${item.label} ${item.date}] ${item.text}`);
    });
  }

  return lines.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  let createdReportId: string | null = null;

  try {
    const { supabaseClient, user } = await requireUser(req);
    const { allowedReportTypes } = await getAccessTier(supabaseClient, user.id);

    if (allowedReportTypes.length === 0) {
      return jsonResponse({ error: 'Subscription required' }, 403, corsHeaders);
    }

    let body: ReportGenerateRequest = {};
    try {
      body = await parseJsonBody<ReportGenerateRequest>(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON body';
      return jsonResponse({ error: message }, 400, corsHeaders);
    }

    const reportType = body.report_type;
    if (!reportType || !KNOWN_REPORT_TYPES.includes(reportType)) {
      return jsonResponse({ error: 'report_type must be weekly, quarterly, or annual' }, 400, corsHeaders);
    }

    if (!allowedReportTypes.includes(reportType)) {
      return jsonResponse({ error: 'Report type not allowed for your subscription' }, 403, corsHeaders);
    }

    let periodStart = '';
    let periodEnd = '';
    let title = '';
    let resolvedYear: number | undefined = undefined;
    let resolvedQuarter: number | undefined = undefined;

    if (reportType === 'weekly') {
      if (!body.weekStart || typeof body.weekStart !== 'string') {
        return jsonResponse({ error: 'weekStart is required for weekly reports' }, 400, corsHeaders);
      }
      let period;
      try {
        period = computeWeeklyPeriod(body.weekStart);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid weekStart';
        return jsonResponse({ error: message }, 400, corsHeaders);
      }
      periodStart = period.periodStart;
      periodEnd = period.periodEnd;
      const startYear = Number(periodStart.slice(0, 4));
      if (body.year !== undefined) {
        if (!Number.isInteger(body.year)) {
          return jsonResponse({ error: 'year must be an integer' }, 400, corsHeaders);
        }
        if (body.year !== startYear) {
          return jsonResponse({ error: 'year does not match weekStart' }, 400, corsHeaders);
        }
      }
      resolvedYear = startYear;
      title = buildReportTitle(reportType, periodStart, periodEnd, resolvedYear);
    }

    if (reportType === 'quarterly') {
      if (!Number.isInteger(body.year)) {
        return jsonResponse({ error: 'year is required for quarterly reports' }, 400, corsHeaders);
      }
      if (!Number.isInteger(body.quarter)) {
        return jsonResponse({ error: 'quarter is required for quarterly reports' }, 400, corsHeaders);
      }
      let period;
      try {
        period = computeQuarterlyPeriod(body.year as number, body.quarter as number);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid quarter or year';
        return jsonResponse({ error: message }, 400, corsHeaders);
      }
      periodStart = period.periodStart;
      periodEnd = period.periodEnd;
      resolvedYear = body.year as number;
      resolvedQuarter = body.quarter as number;
      title = buildReportTitle(reportType, periodStart, periodEnd, resolvedYear, resolvedQuarter);
    }

    if (reportType === 'annual') {
      if (!Number.isInteger(body.year)) {
        return jsonResponse({ error: 'year is required for annual reports' }, 400, corsHeaders);
      }
      let period;
      try {
        period = computeAnnualPeriod(body.year as number);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid year';
        return jsonResponse({ error: message }, 400, corsHeaders);
      }
      periodStart = period.periodStart;
      periodEnd = period.periodEnd;
      resolvedYear = body.year as number;
      title = buildReportTitle(reportType, periodStart, periodEnd, resolvedYear);
    }

    const { data: existingReports, error: existingError } = await supabaseClient
      .from('reports')
      .select('*')
      .eq('user_id', user.id)
      .eq('report_type', reportType)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingError) {
      throw new Error(`Failed to fetch existing report: ${existingError.message}`);
    }

    const existingReport = Array.isArray(existingReports) && existingReports.length > 0
      ? existingReports[0]
      : null;

    if (existingReport) {
      const decryptedContent = existingReport.content
        ? await decryptFieldMaybe(existingReport.content)
        : '';
      return jsonResponse({ report: { ...existingReport, content: decryptedContent } }, 200, corsHeaders);
    }

    const placeholderEnc = await encryptFieldV1('Generating...');

    const { data: createdReport, error: createError } = await supabaseClient
      .from('reports')
      .insert({
        user_id: user.id,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        title,
        content: placeholderEnc,
        status: 'generating',
        year: resolvedYear,
      })
      .select('*')
      .single();

    if (createError || !createdReport) {
      const { data: retryReports, error: retryError } = await supabaseClient
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('report_type', reportType)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!retryError && Array.isArray(retryReports) && retryReports.length > 0) {
        const existing = retryReports[0];
        const decryptedContent = existing.content ? await decryptFieldMaybe(existing.content) : '';
        return jsonResponse({ report: { ...existing, content: decryptedContent } }, 200, corsHeaders);
      }

      throw new Error(`Failed to create report: ${createError?.message || 'Unknown error'}`);
    }

    createdReportId = createdReport.id;

    const { data: lifestyleRows, error: lifestyleError } = await supabaseClient
      .from('lifestyle_entries')
      .select('date, mood, notes, dream_description, meals')
      .eq('user_id', user.id)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('date', { ascending: true });

    if (lifestyleError) {
      throw new Error(`Failed to load lifestyle entries: ${lifestyleError.message}`);
    }

    const decryptedEntries: LifestyleEntryRow[] = await Promise.all(
      (lifestyleRows ?? []).map(async (entry: LifestyleEntryRow) => ({
        ...entry,
        notes: entry.notes ? await decryptFieldMaybe(entry.notes) : null,
        dream_description: entry.dream_description ? await decryptFieldMaybe(entry.dream_description) : null,
        meals: entry.meals ? await decryptFieldMaybe(entry.meals) : null,
      }))
    );

    const moodCounts: Record<string, number> = {};
    const highlights: Array<{ label: string; date: string; text: string }> = [];
    let notesCount = 0;
    let dreamsCount = 0;
    let mealsCount = 0;

    for (const entry of decryptedEntries) {
      if (entry.mood) {
        moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
      }

      const noteText = entry.notes ? cleanText(stripMoodData(entry.notes)) : '';
      const dreamText = entry.dream_description ? cleanText(stripMoodData(entry.dream_description)) : '';
      const mealText = entry.meals ? cleanText(stripMoodData(entry.meals)) : '';

      if (noteText) notesCount += 1;
      if (dreamText) dreamsCount += 1;
      if (mealText) mealsCount += 1;

      if (highlights.length < 3) {
        const addHighlight = (label: string, text: string | null) => {
          if (!text) return;
          if (highlights.length >= 3) return;
          const cleaned = cleanText(stripMoodData(text));
          if (!cleaned) return;
          highlights.push({
            label,
            date: entry.date,
            text: truncate(cleaned, 160),
          });
        };

        addHighlight('Notes', entry.notes);
        addHighlight('Dream', entry.dream_description);
        addHighlight('Meals', entry.meals);
      }
    }

    const startDate = parseDateOnly(periodStart);
    const endDate = parseDateOnly(periodEnd);
    if (!startDate || !endDate) {
      throw new Error('Invalid period dates');
    }

    const endExclusive = addDaysUTC(endDate, 1);

    const { count: fortunesInPeriod, error: fortunesError } = await supabaseClient
      .from('fortunes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endExclusive.toISOString());

    if (fortunesError) {
      throw new Error(`Failed to count fortunes: ${fortunesError.message}`);
    }

    const { data: fortuneCounts, error: fortuneCountsError } = await supabaseClient.rpc('fortune_counts');

    if (fortuneCountsError) {
      throw new Error(`Failed to fetch fortune counts: ${fortuneCountsError.message}`);
    }

    const totalFortunes = Number((fortuneCounts as any)?.total || 0);
    const todayFortunes = Number((fortuneCounts as any)?.today || 0);
    const periodFortunes = Number(fortunesInPeriod || 0);

    const content = buildReportContent({
      title,
      periodStart,
      periodEnd,
      entryCount: decryptedEntries.length,
      moodCounts,
      notesCount,
      dreamsCount,
      mealsCount,
      fortunesInPeriod: periodFortunes,
      fortuneTotal: totalFortunes,
      fortuneToday: todayFortunes,
      highlights,
    });

    const encryptedContent = await encryptFieldV1(content);

    const { data: updatedReport, error: updateError } = await supabaseClient
      .from('reports')
      .update({
        content: encryptedContent,
        status: 'ready',
        error_message: null,
      })
      .eq('id', createdReportId)
      .select('*')
      .single();

    if (updateError || !updatedReport) {
      throw new Error(`Failed to update report: ${updateError?.message || 'Unknown error'}`);
    }

    return jsonResponse({ report: { ...updatedReport, content } }, 200, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (createdReportId) {
      try {
        const { supabaseClient } = await requireUser(req);
        await supabaseClient
          .from('reports')
          .update({ status: 'error', error_message: message })
          .eq('id', createdReportId);
      } catch {
        // Swallow secondary errors when marking report as error
      }
    }

    console.error('Error in report-generate:', error);
    const status = message === 'Authorization required' || message === 'Invalid or expired token' ? 401 : 500;
    return jsonResponse({ error: message }, status, corsHeaders);
  }
});
