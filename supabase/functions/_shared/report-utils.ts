/// <reference lib="deno.ns" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

export const baseCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export type ReportType = 'weekly' | 'quarterly' | 'annual';
export type AccessTier = 'none' | 'essential' | 'growth' | 'pro' | 'lifetime';

export function jsonResponse(payload: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...baseCorsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  const raw = await req.text();
  if (!raw || raw.trim().length === 0) {
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Authorization required');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    throw new Error('Invalid or expired token');
  }

  return { supabaseClient, user };
}

function normalizeTier(value?: string | null): AccessTier | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === 'essential' || v === 'growth' || v === 'pro' || v === 'lifetime') {
    return v as AccessTier;
  }
  return null;
}

function inferTierFromPlanId(planId?: string | null): AccessTier | null {
  if (!planId) return null;
  const p = planId.toLowerCase();
  if (p.includes('lifetime')) return 'lifetime';
  if (p.includes('pro')) return 'pro';
  if (p.includes('growth')) return 'growth';
  if (p.includes('essential')) return 'essential';
  return null;
}

export function getAllowedReportTypes(tier: AccessTier): ReportType[] {
  if (tier === 'growth') return ['weekly', 'annual'];
  if (tier === 'pro' || tier === 'lifetime') return ['weekly', 'quarterly', 'annual'];
  return [];
}

export async function getAccessTier(supabaseClient: any, userId: string) {
  const { data: subscription } = await supabaseClient
    .from('subscriptions')
    .select('status, is_lifetime, tier, plan_id')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle();

  const isTrial = !!(profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date());

  let tier: AccessTier = 'none';
  if (subscription) {
    const status = subscription.status;
    if (subscription.is_lifetime === true && status === 'active') {
      tier = 'lifetime';
    } else if (status === 'active' || status === 'trialing') {
      const explicit = normalizeTier(subscription.tier);
      const inferred = inferTierFromPlanId(subscription.plan_id);
      tier = (explicit ?? inferred ?? 'essential') as AccessTier;
    }
  }

  if (tier === 'none' && isTrial) {
    tier = 'pro';
  }

  const allowedReportTypes = getAllowedReportTypes(tier);
  return { tier, allowedReportTypes, isTrial };
}

export function parseDateOnly(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map((v) => Number(v));
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysUTC(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function computeWeeklyPeriod(weekStart: string) {
  const startDate = parseDateOnly(weekStart);
  if (!startDate) {
    throw new Error('weekStart must be in YYYY-MM-DD format');
  }
  if (startDate.getUTCDay() !== 1) {
    throw new Error('weekStart must be a Monday');
  }
  const endDate = addDaysUTC(startDate, 6);
  return {
    periodStart: formatDateOnly(startDate),
    periodEnd: formatDateOnly(endDate),
  };
}

export function computeQuarterlyPeriod(year: number, quarter: number) {
  if (!Number.isInteger(year)) {
    throw new Error('year must be an integer');
  }
  if (![1, 2, 3, 4].includes(quarter)) {
    throw new Error('quarter must be 1, 2, 3, or 4');
  }
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(Date.UTC(year, startMonth, 1));
  const endDate = new Date(Date.UTC(year, startMonth + 3, 0));
  return {
    periodStart: formatDateOnly(startDate),
    periodEnd: formatDateOnly(endDate),
  };
}

export function computeAnnualPeriod(year: number) {
  if (!Number.isInteger(year)) {
    throw new Error('year must be an integer');
  }
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 12, 0));
  return {
    periodStart: formatDateOnly(startDate),
    periodEnd: formatDateOnly(endDate),
  };
}
