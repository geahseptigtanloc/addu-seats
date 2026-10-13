import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowClockwise, ArrowRight, Buildings, ChartBar, CheckCircle, Clock, Coffee, MapTrifold, Monitor, TrendUp, WarningCircle } from '@phosphor-icons/react';
import { io } from 'socket.io-client';
import AppDialog from '../components/AppDialog.jsx';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiClient, getToken } from '../api/client.js';
import { getGisbertPreviewSeats } from '../data/gisbertPreviewSeats.js';
import { getMiguelProPreviewSeats, MIGUEL_PRO_AREAS } from '../data/miguelProMap.js';
import { formatSeatLocation, getSeatMapPath } from '../data/seatLocations.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

const DATE_RANGES = [
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
];
const DAY_MS = 24 * 60 * 60 * 1000;
const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

function analyticsDateRange(period, now = new Date()) {
  if (period === 'last_30_days' || period === 'last_90_days') {
    const days = period === 'last_30_days' ? 30 : 90;
    return { from: new Date(now.getTime() - days * DAY_MS), to: now };
  }

  // Shift to PHT before finding Monday, then convert local midnight back to UTC.
  const pht = new Date(now.getTime() + PHT_OFFSET_MS);
  const daysSinceMonday = (pht.getUTCDay() + 6) % 7;
  const thisMonday = Date.UTC(pht.getUTCFullYear(), pht.getUTCMonth(), pht.getUTCDate() - daysSinceMonday) - PHT_OFFSET_MS;
  return period === 'last_week'
    ? { from: new Date(thisMonday - 7 * DAY_MS), to: new Date(thisMonday) }
    : { from: new Date(thisMonday), to: now };
}

function analyticsPeriodDates(period) {
  const { from, to } = analyticsDateRange(period);
  const date = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  const lastIncludedDay = period === 'last_week' ? new Date(to.getTime() - 1) : to;
  return `${date.format(from)}–${date.format(lastIncludedDay)}`;
}

const GHOST_REPORT_PAGE_SIZE = 5;

const GISBERT_AREAS = [1, 2, 3, 4].map((floor) => ({
  id: String(floor),
  label: `Floor ${floor}`,
  capacity: getGisbertPreviewSeats(floor).length,
  mapPath: `/map/gisbert/${floor}`,
}));

const LIBRARIES = {
  gisbert: {
    name: 'Gisbert Library',
    filterLabel: 'Floor',
    allLabel: 'All floors',
    areas: GISBERT_AREAS,
  },
  miguel_pro: {
    name: 'Miguel Pro Learning Commons',
    filterLabel: 'Area',
    allLabel: 'All areas',
    areas: MIGUEL_PRO_AREAS.map((area) => ({
      ...area,
      capacity: getMiguelProPreviewSeats(1, area.id).length,
      mapPath: `/map/miguel_pro/1?area=${area.id}`,
    })),
  },
};

const EMPTY_ANALYTICS = {
  utilization: { overallUtilizationPercent: 0, seats: [] },
  peakHours: { hours: [] },
  forecast: { days: [], hasObservedData: false },
  outcomes: { totalCount: 0, outcomes: [] },
  noShowRate: { totalReservations: 0, cancelledCount: 0, noShowRatePercent: 0 },
  sessionLength: { sessionCount: 0, averageSessionMinutes: 0 },
  breakStats: {
    breakCount: 0,
    averageBreakMinutes: 0,
    returnedBreakCount: 0,
    capHitCount: 0,
    capHitPercent: 0,
  },
  locationComparison: { locations: [] },
};

const OUTCOME_STYLES = {
  COMPLETED: { label: 'Completed', color: 'bg-emerald-600' },
  CANCELLED: { label: 'No show', color: 'bg-amber-500' },
  VOIDED: { label: 'Voided', color: 'bg-slate-500' },
  FORFEITED: { label: 'Break expired', color: 'bg-red-600' },
  EVICTED: { label: 'Evicted', color: 'bg-violet-600' },
};

const FLAG_STATUS_LABELS = {
  ACTIVE: 'Active',
  REVERIFIED: 'Presence confirmed',
  EVICTED: 'Evicted',
  VOIDED: 'Voided',
  CHECKED_OUT: 'Checked out',
};

function normalizeGhostReport(report) {
  return {
    ...report,
    flagId: report.flagId || report.reservationId,
    status: String(report.status || 'ACTIVE').toUpperCase(),
    reportedAt: report.reportedAt || report.flaggedAt || new Date().toISOString(),
    windowSeconds: report.windowSeconds || 300,
  };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('this_week');
  const [refreshCount, setRefreshCount] = useState(0);
  const [buildingFilter, setBuildingFilter] = useState('gisbert');
  const [areaFilter, setAreaFilter] = useState('all');
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [ghostReports, setGhostReports] = useState([]);
  const [ghostReportsLoading, setGhostReportsLoading] = useState(true);
  const [ghostReportsError, setGhostReportsError] = useState('');
  const [visibleGhostReportCount, setVisibleGhostReportCount] = useState(GHOST_REPORT_PAGE_SIZE);
  const [selectedGhostReport, setSelectedGhostReport] = useState(null);
  const [ghostResolutionAction, setGhostResolutionAction] = useState('confirm');
  const [voidingGhostReport, setVoidingGhostReport] = useState(false);

  const selectedLibrary = LIBRARIES[buildingFilter];

  useEffect(() => {
    const controller = new AbortController();
    const { from, to } = analyticsDateRange(period);
    const dateParams = {
      from: from.toISOString(),
      to: to.toISOString(),
    };
    const params = new URLSearchParams({
      building: buildingFilter,
      ...dateParams,
    });
    const comparisonParams = new URLSearchParams(dateParams);
    if (buildingFilter === 'gisbert' && areaFilter !== 'all') params.set('floor', areaFilter);
    if (buildingFilter === 'miguel_pro' && areaFilter !== 'all') params.set('area', areaFilter);

    async function loadAnalytics() {
      setLoading(true);
      setLoadError('');
      try {
        const query = params.toString();
        const [utilization, peakHours, forecast, outcomes, noShowRate, sessionLength, breakStats, locationComparison] = await Promise.all([
          apiClient(`/api/analytics/utilization?${query}`, {
            signal: controller.signal,
          }),
          apiClient(`/api/analytics/peak-hours?${query}`, {
            signal: controller.signal,
          }),
          apiClient(`/api/analytics/forecast?${query}`, {
            signal: controller.signal,
          }),
          apiClient(`/api/analytics/outcomes?${query}`, {
            signal: controller.signal,
          }),
          apiClient(`/api/analytics/no-show-rate?${query}`, {
            signal: controller.signal,
          }),
          apiClient(`/api/analytics/session-length?${query}`, {
            signal: controller.signal,
          }),
          apiClient(`/api/analytics/break-stats?${query}`, {
            signal: controller.signal,
          }),
          apiClient(`/api/analytics/location-comparison?${comparisonParams}`, {
            signal: controller.signal,
          }),
        ]);
        setAnalytics({
          utilization,
          peakHours,
          forecast,
          outcomes,
          noShowRate,
          sessionLength,
          breakStats,
          locationComparison,
        });
      } catch (error) {
        if (error.name === 'AbortError') return;
        setAnalytics(EMPTY_ANALYTICS);
        setLoadError('Live analytics are unavailable. No sample data is being shown.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAnalytics();
    return () => controller.abort();
  }, [areaFilter, buildingFilter, period, refreshCount]);

  const loadGhostReports = useCallback(async ({ signal, showLoading = false } = {}) => {
    if (showLoading) setGhostReportsLoading(true);
    setGhostReportsError('');
    try {
      const reports = await apiClient('/api/reservations/flagged?status=all', { signal });
      setGhostReports(Array.isArray(reports) ? reports.map(normalizeGhostReport) : []);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setGhostReportsError('Ghost-seat reports could not be loaded.');
    } finally {
      if (!signal?.aborted) setGhostReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadGhostReports({ signal: controller.signal, showLoading: true });
    const handleFocus = () => loadGhostReports();
    window.addEventListener('focus', handleFocus);
    return () => {
      controller.abort();
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadGhostReports]);

  useEffect(() => {
    if (ghostReports.length <= GHOST_REPORT_PAGE_SIZE) {
      setVisibleGhostReportCount(GHOST_REPORT_PAGE_SIZE);
    }
  }, [ghostReports.length]);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on('connect', () => loadGhostReports());
    socket.on('seat_flagged_admin_notice', (report) => {
      setGhostReports((current) =>
        [
          normalizeGhostReport(report),
          ...current.filter((item) => (item.flagId || item.reservationId) !== (report.flagId || report.reservationId)),
        ],
      );
    });
    socket.on('seat_flag_resolved_admin_notice', ({ flagId, reservationId, resolution, resolvedAt }) => {
      const status = String(resolution || '').toUpperCase();
      setGhostReports((current) => current.map((item) => (
        (flagId && item.flagId === flagId) || item.reservationId === reservationId
          ? { ...item, status, resolvedAt: resolvedAt || new Date().toISOString() }
          : item
      )));
      setSelectedGhostReport(null);
    });
    return () => socket.disconnect();
  }, [loadGhostReports]);

  async function handleResolveGhostSeat() {
    if (!selectedGhostReport || voidingGhostReport) return;

    setVoidingGhostReport(true);
    setGhostReportsError('');
    try {
      const apiPath = ghostResolutionAction === 'void'
        ? `/api/reservations/${selectedGhostReport.reservationId}/void`
        : `/api/reservations/${selectedGhostReport.reservationId}/confirm-ghost`;
      await apiClient(apiPath, {
        method: 'POST',
      });
      setGhostReports((current) =>
        current.map((item) => item.reservationId === selectedGhostReport.reservationId
          ? { ...item, status: 'VOIDED', resolvedAt: new Date().toISOString() }
          : item),
      );
      setSelectedGhostReport(null);
    } catch (error) {
      setGhostReportsError(error.message || 'The reservation could not be voided.');
      setSelectedGhostReport(null);
    } finally {
      setVoidingGhostReport(false);
    }
  }

  const comparisonRows = useMemo(() => (analytics.locationComparison?.locations || []).map(formatComparisonLocation), [analytics.locationComparison]);

  const peakHour = useMemo(() => {
    const hours = analytics.peakHours?.hours || [];
    return hours.reduce((peak, item) => (
      Number(item.occupiedSeatHours || 0) > Number(peak?.occupiedSeatHours || 0) ? item : peak
    ), null);
  }, [analytics.peakHours]);

  const activeGhostReportCount = ghostReports.filter((report) => report.status === 'ACTIVE').length;
  const visibleGhostReports = ghostReports.slice(0, visibleGhostReportCount);
  const hiddenGhostReportCount = Math.max(0, ghostReports.length - visibleGhostReportCount);
  const nextGhostReportBatchSize = Math.min(GHOST_REPORT_PAGE_SIZE, hiddenGhostReportCount);

  const ghostReportStatus = ghostReportsError
    ? 'Status unavailable'
    : ghostReportsLoading
      ? 'Loading reports'
      : activeGhostReportCount
        ? `${activeGhostReportCount} active`
        : 'No active reports';
  const ghostReportStatusClasses = ghostReportsError
    ? 'bg-amber-100 text-amber-900'
    : ghostReportsLoading
      ? 'bg-slate-100 text-slate-700'
      : activeGhostReportCount
        ? 'bg-red-100 text-red-800'
        : 'bg-emerald-100 text-emerald-800';

  return (
    <Layout>
      <section className="ui-surface-band flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-end">
        <div>
          <div className="ui-kicker mb-3">
            <Buildings size={18} weight="fill" />
            {selectedLibrary.name}
          </div>
          <h1 className="ui-page-title">Operations and occupancy analytics</h1>
          <p className="ui-muted mt-2">Administrative trends and front-desk activity for {user?.name}.</p>
        </div>
        <Link to="/frontdesk" className="ui-button-primary self-start">
          <Monitor size={18} weight="bold" />
          Open front desk
        </Link>
      </section>

      {loadError && (
        <div className="ui-alert-info mt-6 flex items-start gap-3">
          <WarningCircle size={20} weight="duotone" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Live analytics unavailable</p>
            <p className="mt-1 text-sm">{loadError}</p>
          </div>
        </div>
      )}

      <section id="ghost-reports" className="ui-panel mt-6 scroll-mt-24 overflow-hidden" aria-label="Ghost-seat reports">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-red-50 text-red-700">
              <WarningCircle size={20} weight="duotone" />
            </span>
            <div>
              <h2 className="ui-section-title">Ghost-seat reports</h2>
              <p className="mt-1 text-xs text-slate-500">Active reports and outcomes from the past 24 hours.</p>
            </div>
          </div>
          <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${ghostReportStatusClasses}`}>{ghostReportStatus}</span>
        </div>
        <div className="p-5">
          {ghostReportsError && (
            <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {ghostReportsError}
            </div>
          )}
          {ghostReportsLoading ? (
            <div className="space-y-3" aria-label="Loading ghost-seat reports">
              {[0, 1].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-[8px] bg-slate-100" />
              ))}
            </div>
          ) : ghostReports.length ? (
            <div className="space-y-3">
              {visibleGhostReports.map((report) => {
                const isActive = report.status === 'ACTIVE';
                const reporterName = report.flaggedBy?.name;
                const reporterId = report.flaggedBy?.studentIdLast4;
                return (
                  <div key={report.flagId || report.reservationId} className={`flex flex-col justify-between gap-3 rounded-[8px] border p-4 sm:flex-row sm:items-center ${isActive ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={isActive ? 'font-semibold text-red-950' : 'font-semibold text-slate-950'}>Flagged seat {report.seatLabel || formatSeatReference(report.seatId)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isActive ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-700'}`}>{FLAG_STATUS_LABELS[report.status] || report.status}</span>
                      </div>
                      <p className={`mt-1 text-sm font-medium ${isActive ? 'text-red-900' : 'text-slate-800'}`}>
                        {formatSeatLocation(report)}
                      </p>
                      <p className={`mt-1 text-sm ${isActive ? 'text-red-800' : 'text-slate-700'}`}>
                        Reserved by {report.studentName || 'Unknown student'}{report.studentIdLast4 ? `, ID ending ${report.studentIdLast4}` : ''}.
                      </p>
                      {reporterName && (
                        <p className="mt-1 text-xs text-slate-600">Reported by {reporterName}{reporterId ? `, ID ending ${reporterId}` : ''}.</p>
                      )}
                      <p className={`mt-1 text-xs leading-5 ${isActive ? 'text-red-700' : 'text-slate-600'}`}>
                        {isActive ? formatFlagDeadline(report.expiresAt) : `Resolved ${formatDateTime(report.resolvedAt)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      {getSeatMapPath(report) && (
                        <Link to={getSeatMapPath(report)} className="ui-button-secondary py-2 text-xs">
                          Open map
                        </Link>
                      )}
                      {isActive && (
                        <>
                          <button type="button" onClick={() => { setGhostResolutionAction('confirm'); setSelectedGhostReport(report); }} className="ui-button-danger bg-red-700 py-2 text-xs text-white hover:bg-red-800">
                            <CheckCircle size={17} weight="bold" />
                            Confirm vacant
                          </button>
                          <button type="button" onClick={() => { setGhostResolutionAction('void'); setSelectedGhostReport(report); }} className="ui-button-secondary py-2 text-xs text-red-800">
                            Void reservation
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {ghostReports.length > GHOST_REPORT_PAGE_SIZE && (
                <div className="flex flex-col justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
                  <p className="text-xs font-medium text-slate-500" aria-live="polite">
                    Showing {visibleGhostReports.length} of {ghostReports.length} reports
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {visibleGhostReportCount > GHOST_REPORT_PAGE_SIZE && (
                      <button
                        type="button"
                        onClick={() => setVisibleGhostReportCount(GHOST_REPORT_PAGE_SIZE)}
                        className="ui-button-secondary py-2 text-xs"
                      >
                        Show fewer
                      </button>
                    )}
                    {hiddenGhostReportCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setVisibleGhostReportCount((count) => count + GHOST_REPORT_PAGE_SIZE)}
                        className="ui-button-primary py-2 text-xs"
                      >
                        View {nextGhostReportBatchSize} more
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : ghostReportsError ? null : (
            <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">New reports appear here immediately. The reservation holder is notified and must scan the seat's verify QR to retain the reservation.</div>
          )}
        </div>
      </section>

      <AppDialog
        open={Boolean(selectedGhostReport)}
        tone="danger"
        title={ghostResolutionAction === 'void' ? 'Void this reservation?' : 'Confirm this seat is vacant?'}
        description={selectedGhostReport ? `This will void ${selectedGhostReport.studentName || 'the student'}'s reservation for ${selectedGhostReport.seatLabel || formatSeatReference(selectedGhostReport.seatId)} at ${formatSeatLocation(selectedGhostReport)}, and release the seat.` : ''}
        confirmLabel="Void reservation"
        cancelLabel="Keep report active"
        busy={voidingGhostReport}
        dismissible={!voidingGhostReport}
        onConfirm={handleResolveGhostSeat}
        onClose={() => setSelectedGhostReport(null)}
      />

      <section className="flex flex-col gap-4 border-b border-slate-200 py-5 lg:flex-row lg:items-end lg:justify-between" aria-label="Analytics filters">
        <div>
          <h2 className="ui-section-title">Usage patterns</h2>
          <p className="mt-1 text-sm text-slate-500">Historical occupancy logs, not current seat availability.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-[9rem_11.5rem_10rem]">
          <FilterSelect label="Period" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {DATE_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Library"
            value={buildingFilter}
            onChange={(event) => {
              setBuildingFilter(event.target.value);
              setAreaFilter('all');
            }}
          >
            <option value="gisbert">Gisbert Library</option>
            <option value="miguel_pro">Miguel Pro</option>
          </FilterSelect>
          <FilterSelect label={selectedLibrary.filterLabel} value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
            <option value="all">{selectedLibrary.allLabel}</option>
            {selectedLibrary.areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </FilterSelect>
        </div>
      </section>

      <section className="ui-panel grid gap-px overflow-hidden bg-slate-200 sm:grid-cols-2 xl:grid-cols-4" aria-label="Analytics summary">
        <Metric label="Recorded seat use" value={formatSeatHours(analytics.utilization?.occupiedSeatHours)} detail={`${formatUtilizationPercent(analytics.utilization?.overallUtilizationPercent, analytics.utilization?.occupiedSeatHours)} average utilization`} loading={loading} />
        <Metric label="Busiest time of day" value={peakHour?.occupiedSeatHours > 0 ? `${formatHour(peakHour.hour)} PHT` : 'No activity yet'} detail={peakHour?.occupiedSeatHours > 0 ? `${formatSeatHours(peakHour.occupiedSeatHours)} recorded` : 'No confirmed seat use in this period'} loading={loading} />
        <Metric label="Average session" value={analytics.sessionLength?.sessionCount ? formatDuration(analytics.sessionLength.averageSessionMinutes) : 'No sessions yet'} detail={`${analytics.sessionLength?.sessionCount || 0} completed sessions`} loading={loading} />
        <Metric label="Recorded breaks" value={analytics.breakStats?.breakCount || 0} detail={`${formatNumber(analytics.breakStats?.averageBreakMinutes)} min average duration`} loading={loading} />
      </section>

      <section className="mt-6 space-y-6">
        <article className="ui-panel overflow-hidden">
          <PanelHeader
            icon={Clock}
            title="Seat use by hour"
            description={`${DATE_RANGES.find((range) => range.value === period)?.label} · ${analyticsPeriodDates(period)} · Philippine Time`}
            action={<button type="button" onClick={() => setRefreshCount((count) => count + 1)} disabled={loading} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50" aria-label="Refresh analytics"><ArrowClockwise size={14} />Refresh</button>}
          />
          <div className="p-5">
            <HourlyChart hours={analytics.peakHours?.hours || []} loading={loading} period={period} />
          </div>
        </article>

        <article className="ui-panel overflow-hidden">
          <PanelHeader icon={MapTrifold} title="Library and area breakdown" description="Gisbert floors and Miguel Pro areas for the selected date range" />
          <div className="p-5">
            <LocationComparison rows={comparisonRows} loading={loading} />
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="ui-panel overflow-hidden">
          <PanelHeader icon={ChartBar} title="Reservation outcomes" description="Completed sessions and integrity-related releases" />
          <div className="p-5">
            <OutcomeChart report={analytics.outcomes} loading={loading} />
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
              <DataPoint label="No-show rate" value={`${formatNumber(analytics.noShowRate?.noShowRatePercent)}%`} loading={loading} />
              <DataPoint label="No-show count" value={analytics.noShowRate?.cancelledCount || 0} loading={loading} />
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">No-shows are reservations that never reached front-desk confirmation. Student cancellations and entry-window expirations share the same status in the current data.</p>
          </div>
        </article>

        <article className="ui-panel overflow-hidden">
          <PanelHeader icon={Coffee} title="Break behavior" description="Break duration and use of the full 15-minute allowance" />
          <div className="p-5">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <DataPoint label="All breaks" value={analytics.breakStats?.breakCount || 0} loading={loading} />
              <DataPoint label="Returned" value={analytics.breakStats?.returnedBreakCount || 0} loading={loading} />
              <DataPoint label="Used full allowance" value={analytics.breakStats?.capHitCount || 0} loading={loading} />
            </div>
            <div className="mt-5 rounded-[8px] border border-slate-200 bg-[#f5f9fc] p-4">
              <p className="text-sm font-semibold text-slate-950">{formatNumber(analytics.breakStats?.capHitPercent)}% of returned breaks used both extensions</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">The cap percentage excludes forfeited breaks because their extension count is not recoverable after expiry.</p>
            </div>
          </div>
        </article>

        <article className="ui-panel overflow-hidden xl:col-span-2">
          <PanelHeader icon={TrendUp} title="Occupancy outlook" description="When seats may be busiest over the next seven days" />
          <div className="p-5">
            <OccupancyForecast forecast={analytics.forecast} loading={loading} />
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Link to="/frontdesk" className="ui-panel group flex items-center justify-between gap-5 p-5 hover:-translate-y-0.5 hover:border-blue-300">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#e6f0f7] text-[#063a64]">
              <Monitor size={23} weight="duotone" />
            </span>
            <span>
              <span className="block font-semibold text-slate-950">Entry verification</span>
              <span className="mt-1 block text-sm text-slate-600">Review pending student reservations.</span>
            </span>
          </div>
          <ArrowRight size={20} weight="bold" className="shrink-0 text-slate-400 group-hover:translate-x-1 group-hover:text-[#063a64]" />
        </Link>
        <Link to="/" className="ui-panel group flex items-center justify-between gap-5 p-5 hover:-translate-y-0.5 hover:border-blue-300">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-slate-100 text-[#063a64]">
              <MapTrifold size={23} weight="duotone" />
            </span>
            <span>
              <span className="block font-semibold text-slate-950">Library maps</span>
              <span className="mt-1 block text-sm text-slate-600">Inspect Gisbert floors and Miguel Pro areas.</span>
            </span>
          </div>
          <ArrowRight size={20} weight="bold" className="shrink-0 text-slate-400 group-hover:translate-x-1 group-hover:text-[#063a64]" />
        </Link>
      </section>
    </Layout>
  );
}

function formatComparisonLocation(location) {
  const building = location.building || 'unknown';
  const floor = Number(location.floor) || 1;
  const area = MIGUEL_PRO_AREAS.find((item) => item.id === location.area);
  return {
    ...location,
    id: `${building}-${floor}-${location.area || 'all'}`,
    label: building === 'miguel_pro'
      ? area?.label || 'Other Miguel Pro seats'
      : `Floor ${floor}`,
    mapPath: getSeatMapPath({ building, floor, area: location.area }) || `/map/${building}/${floor}`,
  };
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="block min-w-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <span className="block">{label}</span>
      <select value={value} onChange={onChange} className="mt-1.5 block h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-900 shadow-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100">
        {children}
      </select>
    </label>
  );
}

function Metric({ label, value, detail, loading }) {
  return (
    <div className="min-w-0 bg-white px-5 py-4">
      <p className="ui-label">{label}</p>
      {loading ? <div className="mt-3 h-9 w-24 animate-pulse rounded bg-slate-100" /> : <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>}
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, description, action }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 bg-white/95 px-5 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#e6f0f7] text-[#063a64]">
        <Icon size={20} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="ui-section-title">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function HourlyChart({ hours, loading, period }) {
  if (loading) return <div className="h-56 animate-pulse rounded-[8px] bg-slate-100" aria-label="Loading hourly analytics" />;
  const highest = Math.max(0, ...hours.map((item) => Number(item.occupiedSeatHours || 0)));
  if (!hours.length || highest === 0) return <EmptyState copy="No confirmed seat use was recorded in this period. Choose another period or location." />;
  const scaleMax = Math.max(1, Math.ceil(highest));
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3 text-xs text-slate-600">
        <span>Recorded seat-hours</span>
        <span>Peak: {formatSeatHours(highest)}</span>
      </div>
      <div className="flex gap-2" role="img" aria-label="Recorded seat-hours by hour in Philippine Time">
        <div className="flex h-44 w-9 shrink-0 flex-col justify-between text-right text-[10px] text-slate-500"><span>{scaleMax}</span><span>0</span></div>
        <div className="flex h-44 min-w-0 flex-1 items-end gap-1 border-b border-slate-300 sm:gap-1.5">
          {hours.map((item) => (
            <div key={item.hour} className="group flex h-full min-w-0 flex-1 items-end" title={`${formatHour(item.hour)} PHT: ${formatSeatHours(item.occupiedSeatHours)}`}>
              <div className="w-full rounded-t-sm bg-[#0c6097] transition-colors group-hover:bg-[#063a64]" style={{ height: item.occupiedSeatHours > 0 ? `${Math.max(1, (item.occupiedSeatHours / scaleMax) * 100)}%` : '0%' }} />
              <span className="sr-only">{formatHour(item.hour)} PHT: {formatSeatHours(item.occupiedSeatHours)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-11 mt-2 grid grid-cols-8 text-[10px] font-medium text-slate-500">
        {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}</span>)}
      </div>
      <p className="mt-3 text-xs text-slate-500">One seat-hour means one seat occupied for one hour. Each bar totals that hour across the selected period.{period === 'this_week' ? ' This week is still in progress.' : ''}</p>
    </div>
  );
}

function LocationComparison({ rows, loading }) {
  if (loading) {
    return (
      <div className="space-y-3" aria-label="Loading location comparison">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-16 animate-pulse rounded-[8px] bg-slate-100" />
        ))}
      </div>
    );
  }
  if (!rows.length) return <EmptyState copy="No mapped locations are available." />;

  const groups = [
    { building: 'gisbert', title: 'Gisbert Library' },
    { building: 'miguel_pro', title: 'Miguel Pro Learning Commons' },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {groups.map((group) => {
        const locations = rows.filter((row) => row.building === group.building);
        if (!locations.length) return null;
        return (
          <section key={group.building} aria-label={group.title}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</h3>
            <div className="divide-y divide-slate-200">
              {locations.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <Link to={item.mapPath} className="text-sm font-semibold text-[#063a64] hover:underline">{item.label}</Link>
                    <p className="mt-0.5 text-xs text-slate-500">{item.seatCount} mapped seats · {formatSeatHours(item.occupiedSeatHours)} recorded</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">{formatUtilizationPercent(item.utilizationPercent, item.occupiedSeatHours)}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <p className="text-xs leading-5 text-slate-500 md:col-span-2">Seat-hours add up occupied time across seats. Utilization compares that time with all mapped seats over the full selected date range.</p>
    </div>
  );
}

function OutcomeChart({ report, loading }) {
  if (loading) return <div className="h-32 animate-pulse rounded-[8px] bg-slate-100" aria-label="Loading reservation outcomes" />;
  const outcomes = report?.outcomes || [];
  const total = report?.totalCount || 0;
  if (!total) return <EmptyState copy="No completed reservation outcomes are available for this period." />;
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-sm bg-slate-100" aria-label={`${total} reservation outcomes`}>
        {outcomes.map((outcome) => {
          const style = OUTCOME_STYLES[outcome.status] || {
            label: outcome.status,
            color: 'bg-slate-400',
          };
          return <div key={outcome.status} className={style.color} style={{ width: `${(outcome.count / total) * 100}%` }} title={`${style.label}: ${outcome.count}`} />;
        })}
      </div>
      <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {outcomes.map((outcome) => {
          const style = OUTCOME_STYLES[outcome.status] || {
            label: outcome.status,
            color: 'bg-slate-400',
          };
          return (
            <div key={outcome.status} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className={`h-2.5 w-2.5 rounded-sm ${style.color}`} />
                {style.label}
              </span>
              <span className="font-mono font-semibold text-slate-950">{outcome.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataPoint({ label, value, loading = false }) {
  return (
    <div>
      <p className="ui-label">{label}</p>
      {loading ? <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" /> : <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>}
    </div>
  );
}

function OccupancyForecast({ forecast, loading }) {
  if (loading) return <div className="h-52 animate-pulse rounded-[8px] bg-slate-100" aria-label="Loading occupancy outlook" />;
  if (forecast?.historyScope !== 'ALL_RECORDED') {
    return <EmptyState copy="The occupancy history summary is temporarily unavailable." />;
  }

  const days = forecast?.days || [];
  const activeHours = forecast?.activeHours || [];
  const firstHour = activeHours.length ? Math.max(0, Math.min(...activeHours) - 1) : 0;
  const lastHour = activeHours.length ? Math.min(23, Math.max(...activeHours) + 1) : 23;
  const visibleHours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);
  const visibleHourSet = new Set(visibleHours);
  const points = days.flatMap((day) => day.hours
    .filter((hour) => visibleHourSet.has(hour.hour))
    .map((hour) => ({
      ...hour,
      date: day.date,
      estimatedSeats: forecastSeatEstimate(hour, forecast?.seatCount),
    })));
  if (!forecast?.hasEnoughHistory || !days.length) {
    const requirements = forecast?.requirements || { activeDays: 5, occupiedHourCells: 12 };
    return (
      <div className="rounded-[8px] border border-blue-100 bg-blue-50 p-5 text-sm text-blue-950">
        <p className="font-semibold">Still learning when seats are used</p>
        <p className="mt-1 leading-6">Recorded seat use: {forecast?.activeDays || 0} of {requirements.activeDays} days and {forecast?.occupiedHourCells || 0} of {requirements.occupiedHourCells} hourly slots needed for an early outlook.</p>
        <p className="mt-2 text-xs leading-5">This uses confirmed sessions from this library or floor, including records outside the dashboard date range. The research paper calls for at least two weeks of logging before a trained forecast.</p>
      </div>
    );
  }

  const estimatedPoints = points.filter((point) => point.estimatedSeats !== null && point.sampleCount > 0);
  if (!estimatedPoints.length) return <EmptyState copy="No usable hourly occupancy samples were found in this selection." />;
  const peak = estimatedPoints.reduce((highest, point) => (
    point.estimatedSeats > highest.estimatedSeats ? point : highest
  ), estimatedPoints[0]);
  const highestEstimate = peak.estimatedSeats;
  const dailyPeaks = days.map((day) => {
    const dayPoints = day.hours
      .map((hour) => ({ ...hour, estimatedSeats: forecastSeatEstimate(hour, forecast.seatCount) }))
      .filter((hour) => hour.sampleCount > 0 && hour.estimatedSeats !== null);
    return {
      date: day.date,
      peak: dayPoints.length
        ? dayPoints.reduce((highest, hour) => hour.estimatedSeats > highest.estimatedSeats ? hour : highest)
        : null,
    };
  });
  const isEarlyEstimate = forecast.historySpanDays < 14;

  return (
    <div className="space-y-5">
      <div className="rounded-[8px] border border-blue-100 bg-blue-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#063a64]">Estimated busiest hour</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{formatForecastDate(peak.date)} at {formatHour(peak.hour)} PHT</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Based on {forecast.activeDays} days of confirmed seat use.</p>
        </div>
        <p className="mt-3 text-lg font-semibold text-[#063a64] sm:mt-0 sm:text-right">{formatApproximateSeats(highestEstimate)}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-950">Busiest hour each day</h3>
        <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
          {dailyPeaks.map((day) => (
            <div key={day.date} className="grid grid-cols-[minmax(5.5rem,1fr)_auto] items-center gap-2 py-2.5 sm:grid-cols-[minmax(7rem,1fr)_8rem_minmax(11rem,1fr)]">
              <p className="text-sm font-semibold text-slate-800">{formatForecastDate(day.date)}</p>
              <p className="text-sm text-slate-700">{day.peak ? `${formatHour(day.peak.hour)} PHT` : 'No estimate'}</p>
              <p className="col-span-2 text-xs text-slate-500 sm:col-span-1 sm:text-right">{day.peak ? formatApproximateSeats(day.peak.estimatedSeats) : 'No comparable past hour'}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs leading-5 text-slate-600">
        {isEarlyEstimate ? 'Early estimate: fewer than two weeks of records are available. ' : ''}
        These are patterns from app-confirmed sessions, not live seat availability or a trained forecast. Untracked visitors are not counted.
      </p>

      <details className="group rounded-[8px] border border-slate-200">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#063a64]">See hourly heatmap</summary>
        <div className="border-t border-slate-200 px-4 py-4">
          <p className="mb-3 text-xs leading-5 text-slate-600">Darker squares mean more estimated seats in use compared with the other hours shown. A dark square does not mean the library is full. Times are in Philippine Time (PHT).</p>
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-600" aria-label="Heatmap scale from zero to the busiest estimate">
            <span>0</span>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <span key={ratio} className="h-3.5 w-5 rounded-sm border border-slate-200" style={forecastCellStyle(highestEstimate * ratio, highestEstimate)} />
            ))}
            <span>{formatSeatEstimate(highestEstimate)}</span>
          </div>
          <div className="overflow-x-auto rounded-[8px] border border-slate-200 bg-slate-50/60 p-3 pb-4">
            <div style={{ minWidth: `${120 + visibleHours.length * 29}px` }}>
              <div className="grid items-end gap-1" style={{ gridTemplateColumns: `7.5rem repeat(${visibleHours.length}, minmax(1.25rem, 1fr))` }} aria-hidden="true">
                <span />
                {visibleHours.map((hour) => (
                  <span key={hour} className="text-center text-[9px] font-semibold text-slate-500">
                    {hour === firstHour || hour === lastHour || hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
                  </span>
                ))}
              </div>
              <div className="mt-1 space-y-1.5" role="img" aria-label="Seven-day estimate of seats in use by hour in Philippine Time">
                {days.map((day) => (
                  <div key={day.date} className="grid items-center gap-1" style={{ gridTemplateColumns: `7.5rem repeat(${visibleHours.length}, minmax(1.25rem, 1fr))` }}>
                    <span className="truncate pr-2 text-xs font-semibold text-slate-700">{formatForecastDate(day.date)}</span>
                    {day.hours.filter((hour) => visibleHourSet.has(hour.hour)).map((hour) => (
                      <span
                        key={hour.hour}
                        className="grid aspect-square min-h-5 place-items-center rounded-sm border border-white/60 text-[8px] font-bold"
                        style={hour.sampleCount > 0 ? forecastCellStyle(forecastSeatEstimate(hour, forecast.seatCount), highestEstimate) : undefined}
                        title={hour.sampleCount > 0
                          ? `${formatForecastDate(day.date)}, ${formatHour(hour.hour)} PHT: ${formatSeatEstimate(forecastSeatEstimate(hour, forecast.seatCount))} estimated from ${hour.sampleCount} earlier hour slot${hour.sampleCount === 1 ? '' : 's'}`
                          : `${formatForecastDate(day.date)}, ${formatHour(hour.hour)} PHT: no historical sample`}
                      >
                        <span className="sr-only">{formatForecastDate(day.date)}, {formatHour(hour.hour)} PHT: {hour.sampleCount > 0 ? formatSeatEstimate(forecastSeatEstimate(hour, forecast.seatCount)) : 'no sample'}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">The hourly pattern uses confirmed seat-use logs since {formatHistoryDate(forecast.from)}. Matching weekdays count first; other days at the same hour fill gaps. The research paper's trained forecast and 95% confidence range are still planned.</p>
        </div>
      </details>
    </div>
  );
}

function forecastCellStyle(value, peakValue) {
  const relativeUse = peakValue > 0 ? Math.max(0, Math.min(1, Number(value) / peakValue)) : 0;
  const opacity = 0.08 + relativeUse * 0.84;
  return {
    backgroundColor: `rgba(6, 58, 100, ${opacity})`,
  };
}

function forecastSeatEstimate(hour, seatCount) {
  if (hour?.predictedOccupiedSeats !== undefined) return hour.predictedOccupiedSeats;
  return hour?.predictedUtilizationPercent === null
    ? null
    : (Number(hour?.predictedUtilizationPercent || 0) * Number(seatCount || 0)) / 100;
}

function formatSeatEstimate(value) {
  if (value === null || !Number.isFinite(Number(value))) return '—';
  if (value > 0 && value < 0.1) return '<0.1 seat';
  const rounded = Number(Number(value).toFixed(1));
  return `${formatNumber(value)} ${rounded === 1 ? 'seat' : 'seats'}`;
}

function formatApproximateSeats(value) {
  if (value <= 0) return 'No recorded use at this hour';
  if (value < 0.5) return 'Less than 1 seat on average';
  const rounded = Math.round(value);
  return `About ${rounded} ${rounded === 1 ? 'seat' : 'seats'} in use`;
}

function formatHistoryDate(date) {
  if (!date) return 'when records began';
  return new Date(date).toLocaleDateString([], {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  });
}

function formatForecastDate(date) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function EmptyState({ copy }) {
  return <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">{copy}</div>;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function formatSeatHours(value) {
  const hours = Number(value || 0);
  if (hours > 0 && hours < 0.1) return '<0.1 seat-hour';
  return `${formatNumber(hours)} seat-${Number(hours.toFixed(1)) === 1 ? 'hour' : 'hours'}`;
}

function formatUtilizationPercent(value, occupiedSeatHours) {
  if (Number(occupiedSeatHours || 0) > 0 && Number(value || 0) === 0) return '<0.1%';
  return `${formatNumber(value)}%`;
}

function formatHour(hour) {
  return new Date(Date.UTC(2000, 0, 1, hour || 0)).toLocaleTimeString([], {
    hour: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDuration(minutes) {
  const value = Number(minutes || 0);
  if (value < 60) return `${formatNumber(value)} min`;
  const hours = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatSeatReference(seatId) {
  if (!seatId) return '';
  return String(seatId).slice(-8).toUpperCase();
}

function formatFlagDeadline(expiresAt) {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return 'The holder must scan the seat verify QR before the response window ends.';
  }
  if (expiry.getTime() <= Date.now()) {
    return 'The re-verification window has elapsed and automatic release is pending.';
  }
  return `The holder must scan the seat verify QR by ${expiry.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
