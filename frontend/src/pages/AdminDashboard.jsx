import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Buildings, CalendarBlank, ChartBar, CheckCircle, Clock, Coffee, LockKey, MapTrifold, Monitor, TrendUp, WarningCircle } from '@phosphor-icons/react';
import { io } from 'socket.io-client';
import AppDialog from '../components/AppDialog.jsx';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiClient, getToken } from '../api/client.js';
import { getGisbertPreviewSeats } from '../data/gisbertPreviewSeats.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

const DATE_RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

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
    areas: [],
  },
};

const EMPTY_ANALYTICS = {
  utilization: { overallUtilizationPercent: 0, seats: [] },
  peakHours: { hours: [] },
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const [rangeDays, setRangeDays] = useState(30);
  const [buildingFilter, setBuildingFilter] = useState('gisbert');
  const [areaFilter, setAreaFilter] = useState('all');
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [ghostReports, setGhostReports] = useState([]);
  const [ghostReportsLoading, setGhostReportsLoading] = useState(true);
  const [ghostReportsError, setGhostReportsError] = useState('');
  const [selectedGhostReport, setSelectedGhostReport] = useState(null);
  const [voidingGhostReport, setVoidingGhostReport] = useState(false);

  const selectedLibrary = LIBRARIES[buildingFilter];

  useEffect(() => {
    const controller = new AbortController();
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
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

    async function loadAnalytics() {
      setLoading(true);
      setLoadError('');
      try {
        const query = params.toString();
        const [utilization, peakHours, outcomes, noShowRate, sessionLength, breakStats, locationComparison] = await Promise.all([
          apiClient(`/api/analytics/utilization?${query}`, {
            signal: controller.signal,
          }),
          apiClient(`/api/analytics/peak-hours?${query}`, {
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
  }, [areaFilter, buildingFilter, rangeDays]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGhostReports() {
      setGhostReportsLoading(true);
      setGhostReportsError('');
      try {
        const reports = await apiClient('/api/reservations/flagged', {
          signal: controller.signal,
        });
        setGhostReports(Array.isArray(reports) ? reports : []);
      } catch (error) {
        if (error.name === 'AbortError') return;
        setGhostReportsError('Active ghost-seat reports could not be loaded.');
      } finally {
        if (!controller.signal.aborted) setGhostReportsLoading(false);
      }
    }

    loadGhostReports();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on('seat_flagged_admin_notice', (report) => {
      setGhostReports((current) =>
        [
          {
            ...report,
            reportedAt: report.reportedAt || new Date().toISOString(),
            windowSeconds: report.windowSeconds || 600,
          },
          ...current.filter((item) => item.reservationId !== report.reservationId),
        ].slice(0, 20),
      );
    });
    socket.on('seat_flag_resolved_admin_notice', ({ reservationId }) => {
      setGhostReports((current) => current.filter((item) => item.reservationId !== reservationId));
      setSelectedGhostReport((current) =>
        current?.reservationId === reservationId ? null : current,
      );
    });
    return () => socket.disconnect();
  }, []);

  async function handleConfirmGhostSeat() {
    if (!selectedGhostReport || voidingGhostReport) return;

    setVoidingGhostReport(true);
    setGhostReportsError('');
    try {
      await apiClient(`/api/reservations/${selectedGhostReport.reservationId}/confirm-ghost`, {
        method: 'POST',
      });
      setGhostReports((current) =>
        current.filter((item) => item.reservationId !== selectedGhostReport.reservationId),
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
    return hours.reduce((peak, item) => (item.utilizationPercent > peak.utilizationPercent ? item : peak), { hour: 0, utilizationPercent: 0 });
  }, [analytics.peakHours]);

  const ghostReportStatus = ghostReportsError
    ? 'Status unavailable'
    : ghostReportsLoading
      ? 'Loading reports'
      : ghostReports.length
        ? `${ghostReports.length} active`
        : 'No active reports';
  const ghostReportStatusClasses = ghostReportsError
    ? 'bg-amber-100 text-amber-900'
    : ghostReportsLoading
      ? 'bg-slate-100 text-slate-700'
      : ghostReports.length
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

      <section className="ui-panel mt-6 overflow-hidden" aria-label="Ghost-seat reports">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-red-50 text-red-700">
              <WarningCircle size={20} weight="duotone" />
            </span>
            <div>
              <h2 className="ui-section-title">Ghost-seat reports</h2>
              <p className="mt-1 text-xs text-slate-500">Students can report an occupied seat that appears physically vacant.</p>
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
              {ghostReports.map((report) => (
                <div key={report.reservationId} className="flex flex-col justify-between gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-red-950">Flagged seat {report.seatLabel || formatSeatReference(report.seatId)}</p>
                    <p className="mt-1 text-sm font-medium text-red-900">
                      {formatBuildingName(report.building)}{report.floor ? `, Floor ${report.floor}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-red-800">
                      Reserved by {report.studentName || 'Unknown student'}{report.studentIdLast4 ? `, ID ending ${report.studentIdLast4}` : ''}.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-red-700">{formatFlagDeadline(report.expiresAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {report.building && report.floor && (
                      <Link to={`/map/${report.building}/${report.floor}`} className="ui-button-secondary py-2 text-xs">
                        Open map
                      </Link>
                    )}
                    <button type="button" onClick={() => setSelectedGhostReport(report)} className="ui-button-danger bg-red-700 py-2 text-xs text-white hover:bg-red-800">
                      <CheckCircle size={17} weight="bold" />
                      Confirm ghost and void
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : ghostReportsError ? null : (
            <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">New reports appear here immediately. The reservation holder is notified and must scan the designated physical QR to retain the reservation.</div>
          )}
        </div>
      </section>

      <AppDialog
        open={Boolean(selectedGhostReport)}
        tone="danger"
        title="Confirm ghost seat?"
        description={selectedGhostReport ? `This will void ${selectedGhostReport.studentName || 'the student'}'s reservation for ${selectedGhostReport.seatLabel || formatSeatReference(selectedGhostReport.seatId)} at ${formatBuildingName(selectedGhostReport.building)}, Floor ${selectedGhostReport.floor}, and release the seat.` : ''}
        confirmLabel="Void reservation"
        cancelLabel="Keep report active"
        busy={voidingGhostReport}
        dismissible={!voidingGhostReport}
        onConfirm={handleConfirmGhostSeat}
        onClose={() => setSelectedGhostReport(null)}
      />

      <section className="flex flex-col gap-3 py-6 sm:flex-row sm:items-end sm:justify-between" aria-label="Analytics filters">
        <div>
          <h2 className="ui-section-title">Usage patterns</h2>
          <p className="mt-1 text-sm text-slate-500">Historical occupancy logs, not current seat availability.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:flex">
          <FilterSelect label="Date range" value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))}>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Analytics summary">
        <Metric icon={TrendUp} label="Average utilization" value={`${formatNumber(analytics.utilization?.overallUtilizationPercent)}%`} detail={areaFilter === 'all' ? `Across ${selectedLibrary.name}` : selectedLibrary.areas.find((area) => area.id === areaFilter)?.label} tone="blue" loading={loading} />
        <Metric icon={Clock} label="Peak usage" value={formatHour(peakHour.hour)} detail={`${formatNumber(peakHour.utilizationPercent)}% utilization`} tone="amber" loading={loading} />
        <Metric icon={ChartBar} label="Average session" value={formatDuration(analytics.sessionLength?.averageSessionMinutes)} detail={`${analytics.sessionLength?.sessionCount || 0} completed sessions`} tone="green" loading={loading} />
        <Metric icon={Coffee} label="Recorded breaks" value={analytics.breakStats?.breakCount || 0} detail={`${formatNumber(analytics.breakStats?.averageBreakMinutes)} min average across returned and forfeited breaks`} tone="violet" loading={loading} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <article className="ui-panel overflow-hidden">
          <PanelHeader icon={Clock} title="Peak occupancy by hour" description="Average utilization by UTC hour across the selected period" />
          <div className="p-5">
            <HourlyChart hours={analytics.peakHours?.hours || []} loading={loading} />
          </div>
        </article>

        <article className="ui-panel overflow-hidden">
          <PanelHeader icon={MapTrifold} title="Location comparison" description="All mapped building and floor groups, ordered by utilization" />
          <div className="p-5">
            <LocationComparison rows={comparisonRows} loading={loading} />
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="ui-panel overflow-hidden">
          <PanelHeader icon={ChartBar} title="Reservation outcomes" description="Completed sessions and integrity-related releases" />
          <div className="p-5">
            <OutcomeChart report={analytics.outcomes} />
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
              <DataPoint label="No-show rate" value={`${formatNumber(analytics.noShowRate?.noShowRatePercent)}%`} />
              <DataPoint label="No-show count" value={analytics.noShowRate?.cancelledCount || 0} />
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
          <PanelHeader icon={LockKey} title="Predictive occupancy" description="Research-target forecasting readiness" />
          <div className="p-5">
            <div className="rounded-[8px] border border-slate-200 bg-[#f5f9fc] p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-white text-[#063a64] shadow-sm">
                  <CalendarBlank size={22} weight="duotone" />
                </span>
                <div>
                  <p className="font-semibold text-slate-950">Waiting for sufficient live data</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Forecasting activates only after at least two weeks of continuous occupancy logs. Only live reservation data will be used.</p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ModelNote title="SARIMA" copy="Seven-day hourly forecast with a 95% confidence interval." />
              <ModelNote title="GBDT / XGBoost" copy="Peak-hour heatmap using calendar, building, and floor context." />
            </div>
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

function formatComparisonLocation(location, index) {
  const building = location.building || 'unknown';
  const floor = Number(location.floor) || 1;
  return {
    ...location,
    id: `${building}-${floor}`,
    rank: index + 1,
    label: `${formatBuildingName(building)}, Floor ${floor}`,
    mapPath: `/map/${building}/${floor}`,
  };
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <select value={value} onChange={onChange} className="mt-1 block w-full min-w-32 rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100">
        {children}
      </select>
    </label>
  );
}

function Metric({ icon: Icon, label, value, detail, tone, loading }) {
  const accents = {
    blue: 'bg-[#e6f0f7] text-[#063a64]',
    amber: 'bg-amber-100 text-amber-900',
    green: 'bg-emerald-100 text-emerald-800',
    violet: 'bg-violet-100 text-violet-800',
  };
  return (
    <div className="ui-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ui-label">{label}</p>
          {loading ? <div className="mt-3 h-9 w-24 animate-pulse rounded bg-slate-100" /> : <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>}
          <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${accents[tone]}`}>
          <Icon size={22} weight="duotone" />
        </span>
      </div>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 bg-white/95 px-5 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#e6f0f7] text-[#063a64]">
        <Icon size={20} weight="duotone" />
      </span>
      <div>
        <h2 className="ui-section-title">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function HourlyChart({ hours, loading }) {
  if (loading) return <div className="h-56 animate-pulse rounded-[8px] bg-slate-100" aria-label="Loading hourly analytics" />;
  if (!hours.length) return <EmptyState copy="No occupancy logs are available for this period." />;
  return (
    <div>
      <div className="flex h-52 items-end gap-1.5 border-b border-slate-200 sm:gap-2" role="img" aria-label="Hourly occupancy utilization bar chart">
        {hours.map((item) => (
          <div key={item.hour} className="group flex h-full min-w-0 flex-1 items-end" title={`${formatHour(item.hour)}: ${formatNumber(item.utilizationPercent)}%`}>
            <div className="relative w-full rounded-t-sm bg-[#0c6097] transition-colors group-hover:bg-[#063a64]" style={{ height: `${Math.max(2, item.utilizationPercent)}%` }}>
              <span className="sr-only">
                {formatHour(item.hour)}: {formatNumber(item.utilizationPercent)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-500">
        <span>{formatHour(hours[0].hour)}</span>
        <span>UTC</span>
        <span>{formatHour(hours[hours.length - 1].hour)}</span>
      </div>
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
  if (!rows.length) return <EmptyState copy="No location utilization is available for this period." />;

  return (
    <ol className="space-y-3" aria-label="Locations ordered from busiest to least busy">
      {rows.map((item) => (
        <li key={item.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border border-slate-200 bg-slate-50/70 p-3">
          <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-white font-mono text-xs font-bold text-slate-600 shadow-sm" aria-label={`Rank ${item.rank}`}>
            {item.rank}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500">{item.seatCount} mapped seats</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-bold text-[#063a64]">{formatNumber(item.utilizationPercent)}%</p>
            <Link to={item.mapPath} className="mt-1 inline-block text-xs font-semibold text-[#063a64] hover:underline">
              Open map
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}

function OutcomeChart({ report }) {
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

function ModelNote({ title, copy }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

function EmptyState({ copy }) {
  return <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">{copy}</div>;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
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

function formatBuildingName(building) {
  if (!building) return 'Library location pending';
  return building.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatSeatReference(seatId) {
  if (!seatId) return '';
  return String(seatId).slice(-8).toUpperCase();
}

function formatFlagDeadline(expiresAt) {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return 'The holder must re-verify at the physical QR within 10 minutes.';
  }
  if (expiry.getTime() <= Date.now()) {
    return 'The re-verification window has elapsed and automatic release is pending.';
  }
  return `The holder must re-verify at the physical QR by ${expiry.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
}
