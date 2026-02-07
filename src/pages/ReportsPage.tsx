import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChartLine } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart,
  Bar,
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { AuthPage } from '@/pages/AuthPage';
import {
  generateReport,
  getReport,
  listReports,
  ReportListItem,
  ReportRow,
  ReportType,
} from '@/lib/edge-functions';

interface ReportPeriod {
  key: string;
  report_type: ReportType;
  label: string;
  period_start: string;
  period_end: string;
  year: number;
  quarter?: number;
  weekStart?: string;
}

type ReportPattern = {
  pattern: string;
  evidence: string[];
  confidence: 'low' | 'medium' | 'high';
  suggestion: string;
  why?: string;
};

type ReportQuest = {
  title: string;
  metric: string;
  target: number;
  why: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

type ReportBlock =
  | {
      type: 'stat_card';
      title: string;
      value: string | number;
      subtitle?: string;
      trend?: string;
    }
  | {
      type: 'bar_chart';
      title: string;
      data: Array<{ label: string; value: number }>;
      xKey?: string;
      valueKey?: string;
      yMin?: number;
      yMax?: number;
    }
  | {
      type: 'line_chart';
      title: string;
      data: Array<Record<string, string | number | null>>;
      xKey: string;
      series: Array<{ key: string; label: string; color?: string }>;
      yMin?: number;
      yMax?: number;
    }
  | {
      type: 'bullet_list';
      title?: string;
      items: string[];
    }
  | {
      type: 'callout';
      tone?: 'info' | 'warning' | 'success';
      badge?: string;
      content: string;
    }
  | {
      type: 'table';
      title?: string;
      columns: string[];
      rows: Array<Array<string | number | null>>;
    }
  | {
      type: 'markdown';
      content: string;
    }
  | {
      type: 'quest_list';
      items: ReportQuest[];
    };

type ReportSection = {
  id: string;
  title: string;
  blocks: ReportBlock[];
};

type ReportModelV1 = {
  schema_version: 1;
  report_type: ReportType;
  period: {
    start: string;
    end: string;
    title: string;
  };
  generated_at: string;
  executive_summary: string;
  dashboard: {
    fortunes: {
      before: number;
      in_period: number;
      total_at_end: number;
    };
    entries_total: number;
    notes_with_content: number;
    dreams_with_content: number;
    meals_with_content: number;
    mood_distribution: Record<string, number>;
    averages: {
      energy: number | null;
      dream_quality: number | null;
      sickness: number | null;
      sexual_appetite: number | null;
      sexual_performance: number | null;
    };
  };
  sections: ReportSection[];
  patterns: ReportPattern[];
  quests: ReportQuest[];
  future_context: string[];
};

const parseReportModel = (content?: string | null): ReportModelV1 | null => {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.schema_version === 1 && parsed.period && parsed.dashboard) {
      return parsed as ReportModelV1;
    }
  } catch {
    return null;
  }
  return null;
};

const formatDateOnlyUTC = (date: Date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDaysUTC = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const buildWeeklyPeriods = (count: number): ReportPeriod[] => {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = todayUTC.getUTCDay();
  const lastSunday = addDaysUTC(todayUTC, -day);
  const periods: ReportPeriod[] = [];

  for (let i = 0; i < count; i += 1) {
    const weekEnd = addDaysUTC(lastSunday, -7 * i);
    const weekStart = addDaysUTC(weekEnd, -6);
    const period_start = formatDateOnlyUTC(weekStart);
    const period_end = formatDateOnlyUTC(weekEnd);
    const year = weekStart.getUTCFullYear();
    const key = `weekly:${period_start}:${period_end}`;

    periods.push({
      key,
      report_type: 'weekly',
      label: `Week of ${period_start}`,
      period_start,
      period_end,
      year,
      weekStart: period_start,
    });
  }

  return periods;
};

const buildQuarterlyPeriods = (year: number): ReportPeriod[] => {
  const periods: ReportPeriod[] = [];
  for (let quarter = 1; quarter <= 4; quarter += 1) {
    const startMonth = (quarter - 1) * 3;
    const startDate = new Date(Date.UTC(year, startMonth, 1));
    const endDate = new Date(Date.UTC(year, startMonth + 3, 0));
    const period_start = formatDateOnlyUTC(startDate);
    const period_end = formatDateOnlyUTC(endDate);
    const key = `quarterly:${period_start}:${period_end}`;

    periods.push({
      key,
      report_type: 'quarterly',
      label: `Q${quarter} ${year}`,
      period_start,
      period_end,
      year,
      quarter,
    });
  }
  return periods;
};

const buildAnnualPeriod = (year: number): ReportPeriod => {
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 12, 0));
  const period_start = formatDateOnlyUTC(startDate);
  const period_end = formatDateOnlyUTC(endDate);
  return {
    key: `annual:${period_start}:${period_end}`,
    report_type: 'annual',
    label: `Year ${year}`,
    period_start,
    period_end,
    year,
  };
};

const isPeriodComplete = (periodEnd: string) => {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endDate = new Date(`${periodEnd}T00:00:00Z`);
  return todayUTC.getTime() > endDate.getTime();
};

const normalizeTier = (tier?: string | null) => {
  if (!tier) return null;
  const t = tier.toLowerCase();
  if (t === 'essential' || t === 'growth' || t === 'pro' || t === 'lifetime') return t;
  return null;
};

const getAllowedTypes = (tier: string) => {
  if (tier === 'growth') return ['weekly', 'annual'];
  if (tier === 'pro' || tier === 'lifetime') return ['weekly', 'quarterly', 'annual'];
  return [] as ReportType[];
};

export const ReportsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, authLoading, sessionInitialized, subscription, isTrialActive } = useSubscription();

  const [reportsByKey, setReportsByKey] = useState<Record<string, ReportListItem>>({});
  const [loading, setLoading] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});
  const [reportPreview, setReportPreview] = useState<ReportRow | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const reportModel = useMemo(() => parseReportModel(reportPreview?.content), [reportPreview?.content]);

  const currentYear = new Date().getUTCFullYear();
  const weeklyPeriods = useMemo(() => buildWeeklyPeriods(8), []);
  const quarterlyPeriods = useMemo(() => buildQuarterlyPeriods(currentYear), [currentYear]);
  const annualPeriod = useMemo(() => buildAnnualPeriod(currentYear), [currentYear]);

  const allPeriods = useMemo(() => {
    return [...weeklyPeriods, ...quarterlyPeriods, annualPeriod];
  }, [weeklyPeriods, quarterlyPeriods, annualPeriod]);

  const accessTier = useMemo(() => {
    if (subscription) {
      if (subscription.is_lifetime === true && subscription.status === 'active') return 'lifetime';
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        return normalizeTier(subscription.tier) ?? 'essential';
      }
    }
    if (isTrialActive) return 'pro';
    return 'none';
  }, [subscription, isTrialActive]);

  const allowedTypes = useMemo(() => getAllowedTypes(accessTier), [accessTier]);

  const setKeyLoading = useCallback((key: string, value: boolean) => {
    setLoadingKeys((prev) => ({ ...prev, [key]: value }));
  }, []);

  const loadReports = useCallback(async () => {
    if (!session || allowedTypes.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const years = Array.from(new Set(allPeriods.map((period) => period.year)));
    const nextMap: Record<string, ReportListItem> = {};

    for (const year of years) {
      const { data, error } = await listReports({ year });
      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to load reports',
          variant: 'destructive',
        });
        continue;
      }

      data?.reports?.forEach((report) => {
        const key = `${report.report_type}:${report.period_start}:${report.period_end}`;
        nextMap[key] = report;
      });
    }

    setReportsByKey(nextMap);
    setLoading(false);
  }, [allPeriods, session, toast, allowedTypes.length]);

  useEffect(() => {
    if (session) {
      void loadReports();
    }
  }, [session, loadReports]);

  const handleViewReport = async (report: ReportListItem, key: string) => {
    setKeyLoading(key, true);
    try {
      const { data, error } = await getReport(report.id);
      if (error) throw new Error(error);

      if (!data?.report) throw new Error('Report not available');
      setReportPreview(data.report);
      setShowReportModal(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load report',
        variant: 'destructive',
      });
    } finally {
      setKeyLoading(key, false);
    }
  };

  const handleGenerateReport = async (period: ReportPeriod, force = false) => {
    if (!allowedTypes.includes(period.report_type)) {
      toast({
        title: 'Subscription Required',
        description: 'Please upgrade to access this report type',
      });
      return;
    }

    setKeyLoading(period.key, true);
    try {
      const payload: any = { report_type: period.report_type, force };
      if (period.report_type === 'weekly') {
        payload.weekStart = period.weekStart;
      } else if (period.report_type === 'quarterly') {
        payload.year = period.year;
        payload.quarter = period.quarter;
      } else {
        payload.year = period.year;
      }

      const { data, error } = await generateReport(payload);
      if (error) throw new Error(error);

      if (!data?.report) throw new Error('Report not available');

      const report = data.report;
      const key = `${report.report_type}:${report.period_start}:${report.period_end}`;
      setReportsByKey((prev) => ({ ...prev, [key]: report }));
      setReportPreview(report);
      setShowReportModal(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message) {
        console.error('Report generate failed:', message);
      }
      if (message.toLowerCase().includes('subscription') || message.toLowerCase().includes('not allowed')) {
        toast({
          title: 'Subscription Required',
          description: 'Please upgrade to access progress reports',
        });
      } else {
        toast({
          title: 'Error',
          description: message || 'Failed to generate report',
          variant: 'destructive',
        });
      }
    } finally {
      setKeyLoading(period.key, false);
    }
  };

  if (authLoading || !sessionInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="luxury-card p-8 text-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <div
      className="min-h-screen bg-background p-6"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
    >
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Reports</h1>
            <p className="text-sm text-muted-foreground">Generate progress reports by period.</p>
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={loadReports} disabled={loading}
              className="gap-2"
            >
              <ChartLine size={16} />
              Refresh
            </Button>
          </div>
        </div>

        {allowedTypes.length === 0 ? (
          <div className="luxury-card p-6">
            <h2 className="text-lg font-heading font-medium">Reports locked</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Upgrade to access progress reports.
            </p>
            <Button className="mt-4" onClick={() => navigate('/pricing')}>Upgrade to Pro</Button>
          </div>
        ) : (
          <>
            <section className="luxury-card p-6">
              <h2 className="text-lg font-heading font-medium mb-4">Weekly Reports</h2>
              <div className="space-y-3">
                {weeklyPeriods.map((period) => {
                  const report = reportsByKey[period.key];
                  const canAccess = allowedTypes.includes(period.report_type);
                  const isBusy = !!loadingKeys[period.key];
                  const canRegenerate = report?.status === 'ready' && report?.error_message === 'openai_failed_fallback_used';
                  const isReady = report?.status === 'ready';
                  const isGenerating = report?.status === 'generating';
                  const isError = report?.status === 'error';
                  return (
                    <div key={period.key} className="flex items-center justify-between gap-4 border border-border rounded-lg p-3">
                      <div>
                        <p className="font-medium">{period.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {period.period_start} to {period.period_end}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {report?.status ?? 'missing'}
                        </p>
                      </div>
                      {report ? (
                        <div className="flex items-center gap-2">
                          {isReady && (
                            <Button
                              variant="outline"
                              onClick={() => handleViewReport(report, period.key)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Loading...' : 'View'}
                            </Button>
                          )}
                          {isGenerating && (
                            <Button variant="outline" disabled>
                              Generating...
                            </Button>
                          )}
                          {isError && (
                            <Button
                              variant="default"
                              onClick={() => handleGenerateReport(period, true)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Retrying...' : 'Retry'}
                            </Button>
                          )}
                          {canRegenerate && (
                            <Button
                              variant="default"
                              onClick={() => handleGenerateReport(period, true)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Regenerating...' : 'Regenerate (AI)'}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleGenerateReport(period, false)}
                          disabled={!canAccess || isBusy}
                        >
                          {isBusy ? 'Generating...' : 'Generate'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="luxury-card p-6">
              <h2 className="text-lg font-heading font-medium mb-4">Quarterly Reports</h2>
              <div className="space-y-3">
                {quarterlyPeriods.map((period) => {
                  const report = reportsByKey[period.key];
                  const canAccess = allowedTypes.includes(period.report_type);
                  const isComplete = isPeriodComplete(period.period_end);
                  const canGenerate = canAccess && isComplete;
                  const isBusy = !!loadingKeys[period.key];
                  const canRegenerate = report?.status === 'ready' && report?.error_message === 'openai_failed_fallback_used';
                  const isReady = report?.status === 'ready';
                  const isGenerating = report?.status === 'generating';
                  const isError = report?.status === 'error';
                  return (
                    <div key={period.key} className="flex items-center justify-between gap-4 border border-border rounded-lg p-3">
                      <div>
                        <p className="font-medium">{period.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {period.period_start} to {period.period_end}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {report?.status ?? (canAccess ? (isComplete ? 'missing' : 'available soon') : 'locked')}
                        </p>
                        {!isComplete && !report && canAccess && (
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                            Available after {period.period_end}
                          </p>
                        )}
                      </div>
                      {report ? (
                        <div className="flex items-center gap-2">
                          {isReady && (
                            <Button
                              variant="outline"
                              onClick={() => handleViewReport(report, period.key)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Loading...' : 'View'}
                            </Button>
                          )}
                          {isGenerating && (
                            <Button variant="outline" disabled>
                              Generating...
                            </Button>
                          )}
                          {isError && (
                            <Button
                              variant="default"
                              onClick={() => handleGenerateReport(period, true)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Retrying...' : 'Retry'}
                            </Button>
                          )}
                          {canRegenerate && (
                            <Button
                              variant="default"
                              onClick={() => handleGenerateReport(period, true)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Regenerating...' : 'Regenerate (AI)'}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleGenerateReport(period, false)}
                          disabled={!canGenerate || isBusy}
                          variant={canGenerate ? 'default' : 'outline'}
                        >
                          {isBusy ? 'Generating...' : canGenerate ? 'Generate' : 'Not ready'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="luxury-card p-6">
              <h2 className="text-lg font-heading font-medium mb-4">Annual Report</h2>
              <div className="space-y-3">
                {(() => {
                  const period = annualPeriod;
                  const report = reportsByKey[period.key];
                  const canAccess = allowedTypes.includes(period.report_type);
                  const isComplete = isPeriodComplete(period.period_end);
                  const canGenerate = canAccess && isComplete;
                  const isBusy = !!loadingKeys[period.key];
                  const canRegenerate = report?.status === 'ready' && report?.error_message === 'openai_failed_fallback_used';
                  const isReady = report?.status === 'ready';
                  const isGenerating = report?.status === 'generating';
                  const isError = report?.status === 'error';
                  return (
                    <div className="flex items-center justify-between gap-4 border border-border rounded-lg p-3">
                      <div>
                        <p className="font-medium">{period.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {period.period_start} to {period.period_end}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {report?.status ?? (canAccess ? (isComplete ? 'missing' : 'available soon') : 'locked')}
                        </p>
                        {!isComplete && !report && canAccess && (
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                            Available after {period.period_end}
                          </p>
                        )}
                      </div>
                      {report ? (
                        <div className="flex items-center gap-2">
                          {isReady && (
                            <Button
                              variant="outline"
                              onClick={() => handleViewReport(report, period.key)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Loading...' : 'View'}
                            </Button>
                          )}
                          {isGenerating && (
                            <Button variant="outline" disabled>
                              Generating...
                            </Button>
                          )}
                          {isError && (
                            <Button
                              variant="default"
                              onClick={() => handleGenerateReport(period, true)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Retrying...' : 'Retry'}
                            </Button>
                          )}
                          {canRegenerate && (
                            <Button
                              variant="default"
                              onClick={() => handleGenerateReport(period, true)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Regenerating...' : 'Regenerate (AI)'}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleGenerateReport(period, false)}
                          disabled={!canGenerate || isBusy}
                        >
                          {isBusy ? 'Generating...' : canGenerate ? 'Generate' : 'Not ready'}
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </section>
          </>
        )}
      </div>

      <Dialog
        open={showReportModal}
        onOpenChange={(open) => {
          setShowReportModal(open);
          if (!open) {
            setReportPreview(null);
          }
        }}
      >
      <DialogContent className="mx-auto w-full max-w-3xl max-h-[85vh] flex flex-col">
        <DialogTitle>{reportPreview?.title ?? 'Progress Report'}</DialogTitle>
        <DialogDescription>
          {reportPreview
            ? `${reportPreview.report_type} | ${reportPreview.period_start} to ${reportPreview.period_end}`
            : 'Your report summary'}
        </DialogDescription>
        <div className="mt-4 flex-1 min-h-0 overflow-auto text-sm text-foreground">
          {reportModel ? (
            <ReportModelView model={reportModel} />
          ) : reportPreview?.content ? (
            <div className="prose prose-base max-w-none text-foreground prose-headings:font-heading prose-strong:text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-xl font-heading">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-heading mt-6">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-heading mt-4">{children}</h3>,
                  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  table: ({ children }) => (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-border px-2 py-1 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => <td className="border-b border-border px-2 py-1">{children}</td>,
                  hr: () => <hr className="my-4 border-border" />,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-gold/50 pl-3 italic text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {reportPreview.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted-foreground">No report content available.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  </div>
);
};

export default ReportsPage;

const ReportModelView = ({ model }: { model: ReportModelV1 }) => {
  const hasBarData = (data: Array<{ label: string; value: number }>) =>
    Array.isArray(data) && data.some((item) => Number(item.value) > 0);

  const hasLineData = (data: Array<Record<string, string | number | null>>, series: Array<{ key: string }>) =>
    Array.isArray(data) && data.some((row) =>
      series.some((s) => {
        const value = row?.[s.key];
        return typeof value === 'number' && !Number.isNaN(value);
      })
    );

  const isSpanish = /[áéíóúñ]|\\b(que|de|y|pero|para|semana|sueño|ánimo|energía|comidas)\\b/i.test(
    model.executive_summary ?? ''
  );
  const lowLabel = isSpanish ? 'Bajo' : 'Low';
  const midLabel = isSpanish ? 'Medio' : 'Mid';
  const highLabel = isSpanish ? 'Alto' : 'High';

  const buildQualitativeTicks = (min: number, max: number) => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
    const mid = Number(((min + max) / 2).toFixed(2));
    return [min, mid, max];
  };

  const qualitativeTickFormatter = (min: number, max: number) => (value: number) => {
    if (!Number.isFinite(value)) return '';
    if (value <= min) return lowLabel;
    if (value >= max) return highLabel;
    return midLabel;
  };

  const getBarDomain = (block: Extract<ReportBlock, { type: 'bar_chart' }>) => {
    const min = Number.isFinite(block.yMin) ? (block.yMin as number) : 0;
    const maxFromData = Math.max(0, ...block.data.map((item) => item.value || 0));
    const max = Number.isFinite(block.yMax) ? (block.yMax as number) : maxFromData;
    return { min, max };
  };

  const getLineDomain = (block: Extract<ReportBlock, { type: 'line_chart' }>) => {
    let min = Number.isFinite(block.yMin) ? (block.yMin as number) : Number.POSITIVE_INFINITY;
    let max = Number.isFinite(block.yMax) ? (block.yMax as number) : Number.NEGATIVE_INFINITY;

    if (!Number.isFinite(block.yMin) || !Number.isFinite(block.yMax)) {
      block.data.forEach((row) => {
        block.series.forEach((series) => {
          const value = row?.[series.key];
          if (typeof value === 'number' && !Number.isNaN(value)) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        });
      });
    }

    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;
    return { min, max };
  };

  const renderBlock = (block: ReportBlock, idx: number) => {
    switch (block.type) {
      case 'stat_card':
        return (
          <div key={idx} className="rounded-lg border border-border bg-card/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{block.title}</p>
            <p className="text-lg font-semibold">{block.value}</p>
            {block.subtitle && <p className="text-xs text-muted-foreground">{block.subtitle}</p>}
            {block.trend && <p className="text-xs text-emerald-400">{block.trend}</p>}
          </div>
        );
      case 'bar_chart': {
        const barDomain = getBarDomain(block);
        const barTicks = buildQualitativeTicks(barDomain.min, barDomain.max);
        return (
          <div key={idx} className="rounded-lg border border-border bg-card/60 p-3 md:col-span-2">
            <p className="text-sm font-medium mb-2">{block.title}</p>
            {hasBarData(block.data) ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={block.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={block.xKey ?? 'label'} tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine
                      allowDecimals={false}
                      domain={[
                        Number.isFinite(block.yMin) ? block.yMin : 'auto',
                        Number.isFinite(block.yMax) ? block.yMax : 'auto',
                      ]}
                      ticks={barTicks.length ? barTicks : undefined}
                      tickFormatter={qualitativeTickFormatter(barDomain.min, barDomain.max)}
                    />
                    <Tooltip />
                    <Bar dataKey={block.valueKey ?? 'value'} fill="#E5C16C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data available for this chart.</p>
            )}
          </div>
        );
      }
      case 'line_chart': {
        const lineDomain = getLineDomain(block);
        const lineTicks = buildQualitativeTicks(lineDomain.min, lineDomain.max);
        return (
          <div key={idx} className="rounded-lg border border-border bg-card/60 p-3 md:col-span-2">
            <p className="text-sm font-medium mb-2">{block.title}</p>
            {hasLineData(block.data, block.series) ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={block.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={block.xKey} tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine
                      domain={[
                        Number.isFinite(block.yMin) ? block.yMin : 'auto',
                        Number.isFinite(block.yMax) ? block.yMax : 'auto',
                      ]}
                      ticks={lineTicks.length ? lineTicks : undefined}
                      tickFormatter={qualitativeTickFormatter(lineDomain.min, lineDomain.max)}
                    />
                    <Tooltip />
                    {block.series.map((series, index) => (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        name={series.label}
                        stroke={series.color ?? (index % 2 === 0 ? '#E5C16C' : '#7BC67B')}
                        strokeWidth={2}
                        strokeDasharray={series.key === 'community' ? '6 4' : undefined}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data available for this chart.</p>
            )}
          </div>
        );
      }
      case 'bullet_list':
        return (
          <div key={idx} className="rounded-lg border border-border bg-card/60 p-3 space-y-2 md:col-span-2">
            {block.title && <p className="text-sm font-medium">{block.title}</p>}
            <ul className="list-disc pl-5 space-y-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="text-sm leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>
        );
      case 'callout':
        return (
          <div key={idx} className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm md:col-span-2 whitespace-pre-line space-y-2">
            {block.badge && (
              <span className="inline-flex items-center rounded-full border border-gold/40 bg-background/70 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                {block.badge}
              </span>
            )}
            <div>{block.content}</div>
          </div>
        );
      case 'table':
        return (
          <div key={idx} className="rounded-lg border border-border bg-card/60 p-3 md:col-span-2">
            {block.title && <p className="text-sm font-medium mb-2">{block.title}</p>}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {block.columns.map((col, colIdx) => (
                      <th key={colIdx} className="border-b border-border px-2 py-1 text-left uppercase tracking-wide text-muted-foreground">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="border-b border-border px-2 py-1">
                          {cell ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'markdown':
        return (
          <div key={idx} className="rounded-lg border border-border bg-card/60 p-3 md:col-span-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {block.content}
            </ReactMarkdown>
          </div>
        );
      case 'quest_list':
        return (
          <div key={idx} className="rounded-lg border border-border bg-card/60 p-3 md:col-span-2">
            <div className="space-y-3">
              {block.items.map((quest, questIdx) => (
                <div key={questIdx} className="rounded-md border border-border/70 bg-background/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{quest.title}</p>
                    <span className="text-xs uppercase text-muted-foreground">{quest.difficulty}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{quest.metric} • target {quest.target}</p>
                  <p className="text-sm mt-2">{quest.why}</p>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const sections = model.report_type === 'weekly'
    ? model.sections.filter((section) => section.id !== 'pattern_lab')
    : model.sections;
  const hasContextSection = sections.some((section) => section.id === 'context_future');
  const summaryParagraphs = (model.executive_summary || '')
    .split(/\n\s*\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entryCount = model.dashboard?.entries_total ?? 0;
  const fortunesInPeriod = model.dashboard?.fortunes?.in_period ?? 0;
  const totalFortunes = model.dashboard?.fortunes?.total_at_end ?? 0;
  const streakNow = model.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.type === 'stat_card' && block.title === 'Current Streak') as { value?: number } | undefined;
  const streakValue = typeof streakNow?.value === 'number' ? streakNow.value : 0;

  const momentumScore = Math.min(100, Math.max(0, entryCount * 12 + fortunesInPeriod * 8 + streakValue * 10));
  const momentumLabel = isSpanish
    ? (momentumScore >= 70 ? '🔥 En racha' : momentumScore >= 40 ? '⚡ En marcha' : '🌱 Re‑inicio')
    : (momentumScore >= 70 ? '🔥 On fire' : momentumScore >= 40 ? '⚡ In motion' : '🌱 Reset');

  const highlightPreview = model.sections
    .find((section) => section.id === 'highlights')
    ?.blocks.find((block) => block.type === 'bullet_list') as { items?: string[] } | undefined;
  const spotlightText = highlightPreview?.items?.[0] ?? '';

  const getSectionBlock = <T extends ReportBlock['type']>(id: string, type: T) => {
    const section = model.sections.find((sec) => sec.id === id);
    const block = section?.blocks.find((b) => b.type === type) as Extract<ReportBlock, { type: T }> | undefined;
    return block;
  };

  const energyBlock = getSectionBlock('visual_dashboard', 'line_chart');
  const moodBlock = getSectionBlock('visual_dashboard', 'bar_chart');
  const energyLabel = isSpanish ? 'Energía' : 'Energy';
  const moodLabel = isSpanish ? 'Ánimo' : 'Mood';

  const getAverage = (data: Array<Record<string, string | number | null>>, key: string) => {
    const values = data
      .map((row) => row?.[key])
      .filter((value) => typeof value === 'number' && !Number.isNaN(value)) as number[];
    if (!values.length) return null;
    return Number((values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(2));
  };

  const energyAvg = energyBlock?.type === 'line_chart' ? getAverage(energyBlock.data, 'value') : null;
  const energyCommunity = energyBlock?.type === 'line_chart' ? getAverage(energyBlock.data, 'community') : null;
  const energyDelta = energyAvg !== null && energyCommunity !== null ? Number((energyAvg - energyCommunity).toFixed(2)) : null;

  const dominantMood = moodBlock?.type === 'bar_chart'
    ? moodBlock.data.slice().sort((a, b) => b.value - a.value)[0]?.label
    : null;

  const trendBadge = energyDelta !== null
    ? (energyDelta >= 0
      ? (isSpanish ? `↑ ${energyDelta} vs media` : `↑ ${energyDelta} vs avg`)
      : (isSpanish ? `↓ ${Math.abs(energyDelta)} vs media` : `↓ ${Math.abs(energyDelta)} vs avg`))
    : (isSpanish ? 'Sin media global' : 'No community avg');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-gold/10 via-background to-background p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {isSpanish ? 'Resumen Ejecutivo' : 'Executive Summary'}
            </p>
            <p className="text-lg font-heading">{momentumLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs uppercase tracking-wide">
              {isSpanish ? `${entryCount} entradas` : `${entryCount} entries`}
            </span>
            <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs uppercase tracking-wide">
              {isSpanish ? `${fortunesInPeriod} fortunas` : `${fortunesInPeriod} fortunes`}
            </span>
            <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs uppercase tracking-wide">
              {isSpanish ? `Racha ${streakValue}` : `Streak ${streakValue}`}
            </span>
            <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs uppercase tracking-wide">
              {isSpanish ? `Total ${totalFortunes}` : `Total ${totalFortunes}`}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{energyLabel}</p>
            <p className="text-lg font-semibold">{energyAvg ?? '–'}</p>
            <p className="text-xs text-muted-foreground">{trendBadge}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{moodLabel}</p>
            <p className="text-lg font-semibold">{dominantMood ?? '–'}</p>
            <p className="text-xs text-muted-foreground">
              {isSpanish ? 'Mood dominante' : 'Dominant mood'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {isSpanish ? 'Momentum' : 'Momentum'}
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-border">
              <div
                className="h-2 rounded-full bg-gold/80"
                style={{ width: `${momentumScore}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{momentumScore}/100</p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          {summaryParagraphs.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        {spotlightText && (
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {isSpanish ? '✨ Weekly Spotlight' : '✨ Weekly Spotlight'}
            </p>
            <p>{spotlightText}</p>
          </div>
        )}
      </div>

      {sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <h3 className="text-lg font-heading">{section.title}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {section.blocks.map((block, idx) => renderBlock(block, idx))}
          </div>
        </section>
      ))}

      {!hasContextSection && model.report_type !== 'weekly' && model.future_context?.length > 0 && (
        <section className="rounded-lg border border-border bg-card/60 p-3">
          <p className="text-sm font-medium mb-2">🔗 Context for Future Reports</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {model.future_context.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
