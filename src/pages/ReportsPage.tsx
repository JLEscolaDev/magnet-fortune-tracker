import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChartLine } from '@phosphor-icons/react';
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
      const { data, error } = await listReports(year);
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

  const handleGenerateReport = async (period: ReportPeriod) => {
    if (!allowedTypes.includes(period.report_type)) {
      toast({
        title: 'Subscription Required',
        description: 'Please upgrade to access this report type',
      });
      return;
    }

    setKeyLoading(period.key, true);
    try {
      const payload: any = { report_type: period.report_type };
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
      if (message.toLowerCase().includes('subscription') || message.toLowerCase().includes('not allowed')) {
        toast({
          title: 'Subscription Required',
          description: 'Please upgrade to access progress reports',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to generate report',
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
      <div className="max-w-4xl mx-auto space-y-6">
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
                        <Button
                          variant="outline"
                          onClick={() => handleViewReport(report, period.key)}
                          disabled={isBusy}
                        >
                          {isBusy ? 'Loading...' : 'View'}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleGenerateReport(period)}
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
                  const isBusy = !!loadingKeys[period.key];
                  return (
                    <div key={period.key} className="flex items-center justify-between gap-4 border border-border rounded-lg p-3">
                      <div>
                        <p className="font-medium">{period.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {period.period_start} to {period.period_end}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {report?.status ?? (canAccess ? 'missing' : 'locked')}
                        </p>
                      </div>
                      {report ? (
                        <Button
                          variant="outline"
                          onClick={() => handleViewReport(report, period.key)}
                          disabled={isBusy}
                        >
                          {isBusy ? 'Loading...' : 'View'}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleGenerateReport(period)}
                          disabled={!canAccess || isBusy}
                          variant={canAccess ? 'default' : 'outline'}
                        >
                          {isBusy ? 'Generating...' : canAccess ? 'Generate' : 'Locked'}
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
                  const isBusy = !!loadingKeys[period.key];
                  return (
                    <div className="flex items-center justify-between gap-4 border border-border rounded-lg p-3">
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
                        <Button
                          variant="outline"
                          onClick={() => handleViewReport(report, period.key)}
                          disabled={isBusy}
                        >
                          {isBusy ? 'Loading...' : 'View'}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleGenerateReport(period)}
                          disabled={!canAccess || isBusy}
                        >
                          {isBusy ? 'Generating...' : 'Generate'}
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
        <DialogContent className="max-w-3xl">
          <DialogTitle>{reportPreview?.title ?? 'Progress Report'}</DialogTitle>
          <DialogDescription>
            {reportPreview
              ? `${reportPreview.report_type} | ${reportPreview.period_start} to ${reportPreview.period_end}`
              : 'Your report summary'}
          </DialogDescription>
          <div className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm text-foreground">
            {reportPreview?.content ?? ''}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsPage;
