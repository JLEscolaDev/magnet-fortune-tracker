import { supabase } from '@/integrations/supabase/client';

export interface EdgeFunctionResponse<T = unknown> {
  data?: T;
  error?: string;
}

/**
 * Generic Edge Function caller.
 *
 * IMPORTANT:
 * - Uses `supabase.functions.invoke` so we do NOT hardcode the Supabase project URL.
 * - Optionally injects Authorization header from the current session.
 */
export const callEdge = async <T = unknown>(
  functionName: string,
  body: Record<string, unknown> = {},
  requireAuth: boolean = true
): Promise<EdgeFunctionResponse<T>> => {
  try {
    const headers: Record<string, string> = {};

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (requireAuth && !token) {
      throw new Error('No authentication token available');
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const safeBody = (body ?? {}) as Record<string, unknown>;

    const { data, error, response } = await supabase.functions.invoke(functionName, {
      body: safeBody,
      headers,
    });

    if (error) {
      let message = error.message || 'Request failed';
      if (response) {
        try {
          const clone = response.clone();
          const contentType = clone.headers.get('Content-Type') || '';
          const rawText = await clone.text();
          const trimmed = rawText.slice(0, 2000);
          if (contentType.includes('application/json')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed?.error) {
                message = String(parsed.error);
              }
              if (parsed?.stage) {
                message = `${message} (stage: ${parsed.stage})`;
              }
            } catch {
              // ignore JSON parse errors
            }
          } else if (trimmed) {
            message = `${message} (${trimmed})`;
          }
        } catch {
          // ignore response parsing errors
        }
      }
      throw new Error(message);
    }

    return { data: data as T };
  } catch (error) {
    console.error(`Error calling edge function ${functionName}:`, error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// -------------------------
// Lifestyle Entries helpers
// -------------------------

export interface LifestyleEntryRow {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  dream_quality?: number | null;
  dream_description?: string | null;
  meals?: string | null;
  alcohol_consumption?: number | null;
  mood?: string | null;
  sickness_level?: number | null;
  exercise_type?: string | null;
  exercise_duration?: number | null;
  sexual_appetite?: number | null;
  sexual_performance?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  mood_set_at?: string | null;
  room_temperature?: number | null;
  energy_level?: number | null;
}

export interface LifestyleEntryListResponse {
  entries: LifestyleEntryRow[];
}

export interface LifestyleEntryListParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  limit?: number;
}

export const listLifestyleEntries = async (
  params: LifestyleEntryListParams = {}
): Promise<EdgeFunctionResponse<LifestyleEntryListResponse>> => {
  const res = await callEdge<any>('lifestyle-entry-list', params, true);

  if (res.error) {
    return { error: res.error };
  }

  const data = res.data;

  // Preferred shape: { entries: LifestyleEntryRow[] }
  if (data && typeof data === 'object' && 'entries' in data) {
    return { data: data as LifestyleEntryListResponse };
  }

  // Backward/alternative shape: LifestyleEntryRow[]
  if (Array.isArray(data)) {
    return { data: { entries: data as LifestyleEntryRow[] } };
  }

  return { error: 'Invalid response from lifestyle-entry-list' };
};

export interface LifestyleEntryUpsertInput {
  date: string; // YYYY-MM-DD
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

export interface LifestyleEntryUpsertResponse {
  entry: LifestyleEntryRow;
}

export const upsertLifestyleEntry = async (
  input: LifestyleEntryUpsertInput
): Promise<EdgeFunctionResponse<LifestyleEntryUpsertResponse>> => {
  const res = await callEdge<any>('lifestyle-entry-upsert', input, true);

  if (res.error) {
    return { error: res.error };
  }

  const data = res.data;

  // Preferred shape: { entry: LifestyleEntryRow }
  if (data && typeof data === 'object' && 'entry' in data) {
    return { data: data as LifestyleEntryUpsertResponse };
  }

  // Backward/alternative shape: LifestyleEntryRow
  return { data: { entry: data as LifestyleEntryRow } };
};

// -------------------------
// Reports helpers
// -------------------------

export type ReportType = 'weekly' | 'quarterly' | 'annual';

export interface ReportListItem {
  id: string;
  report_type: ReportType;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  title: string;
  status: string;
  created_at: string;
  updated_at?: string;
  year?: number | null;
}

export interface ReportRow extends ReportListItem {
  content: string;
  error_message?: string | null;
}

export interface ReportListResponse {
  reports: ReportListItem[];
}

export interface ReportGetResponse {
  report: ReportRow;
}

export interface ReportGenerateResponse {
  report: ReportRow;
}

export interface ReportListParams {
  year?: number;
}

export interface ReportGenerateInput {
  report_type: ReportType;
  year?: number;
  weekStart?: string;
  quarter?: 1 | 2 | 3 | 4;
  force?: boolean;
}

export const listReports = async (
  params: ReportListParams = {}
): Promise<EdgeFunctionResponse<ReportListResponse>> => {
  const res = await callEdge<any>('report-list', params, true);

  if (res.error) {
    return { error: res.error };
  }

  const data = res.data;

  if (data && typeof data === 'object' && 'reports' in data) {
    return { data: data as ReportListResponse };
  }

  if (Array.isArray(data)) {
    return { data: { reports: data as ReportListItem[] } };
  }

  return { error: 'Invalid response from report-list' };
};

export const getReport = async (
  report_id: string
): Promise<EdgeFunctionResponse<ReportGetResponse>> => {
  const res = await callEdge<any>('report-get', { report_id }, true);

  if (res.error) {
    return { error: res.error };
  }

  const data = res.data;

  if (data && typeof data === 'object' && 'report' in data) {
    return { data: data as ReportGetResponse };
  }

  return { data: { report: data as ReportRow } };
};

export const generateReport = async (
  input: ReportGenerateInput
): Promise<EdgeFunctionResponse<ReportGenerateResponse>> => {
  const res = await callEdge<any>('report-generate', input, true);

  if (res.error) {
    return { error: res.error };
  }

  const data = res.data;

  if (data && typeof data === 'object' && 'report' in data) {
    return { data: data as ReportGenerateResponse };
  }

  return { data: { report: data as ReportRow } };
};
