import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Buildings,
  CalendarBlank,
  ChartBar,
  Clock,
  Coffee,
  LockKey,
  MapTrifold,
  Monitor,
  TrendUp,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { io } from 'socket.io-client';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiClient, getToken } from '../api/client.js';
import { getGisbertPreviewSeats } from '../data/gisbertPreviewSeats.js';
import { getMiguelProPreviewSeats, MIGUEL_PRO_AREAS } from '../data/miguelProMap.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

const DATE_RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

const SAMPLE_GISBERT_AREAS = [
  { floor: 1, utilization: 62.4 },
  { floor: 2, utilization: 47.8 },
  { floor: 3, utilization: 70.9 },
  { floor: 4, utilization: 55.3 },
].map((item) => ({
  ...item,
  id: String(item.floor),
  label: `Floor ${item.floor}`,
  capacity: getGisbertPreviewSeats(item.floor).length,
  mapPath: `/map/gisbert/${item.floor}`,
}));

const MIGUEL_PRO_SAMPLE_UTILIZATION = {
  main_area: 64.7,
  research_nook: 52.3,
  workspace_room: 71.6,
};

const SAMPLE_MIGUEL_PRO_AREAS = MIGUEL_PRO_AREAS.map((area) => ({
  id: area.id,
  label: area.label,
  capacity: getMiguelProPreviewSeats(1, area.id).length,
  utilization: MIGUEL_PRO_SAMPLE_UTILIZATION[area.id],
  mapPath: `/map/miguel_pro/1?area=${area.id}`,
}));

const LIBRARIES = {
  gisbert: {
    name: 'Gisbert Library',
    filterLabel: 'Floor',
    allLabel: 'All floors',
    demandTitle: 'Floor demand',
    demandDescription: 'Frequently used areas by floor',
    sampleAreas: SAMPLE_GISBERT_AREAS,
  },
  miguel_pro: {
    name: 'Miguel Pro Learning Commons',
    filterLabel: 'Area',
    allLabel: 'All areas',
    demandTitle: 'Area demand',
    demandDescription: 'Frequently used rooms and study areas',
    sampleAreas: SAMPLE_MIGUEL_PRO_AREAS,
  },
};

const SAMPLE_ANALYTICS = {
  utilization: { overallUtilizationPercent: 60.1, seats: [] },
  peakHours: {
    hours: [
      8, 12, 19, 33, 48, 63, 71, 68, 59, 54, 61, 73, 78, 69, 51, 31,
    ].map((utilizationPercent, index) => ({ hour: index + 7, utilizationPercent })),
  },
  outcomes: {
    totalCount: 367,
    outcomes: [
      { status: 'COMPLETED', count: 318 },
      { status: 'CANCELLED', count: 22 },
      { status: 'VOIDED', count: 14 },
      { status: 'FORFEITED', count: 9 },
      { status: 'EVICTED', count: 4 },
    ],
  },
  noShowRate: { totalReservations: 367, cancelledCount: 22, noShowRatePercent: 6 },
  sessionLength: { sessionCount: 318, averageSessionMinutes: 96.4 },
  breakStats: { breakCount: 143, averageBreakMinutes: 7.2 },
};

const MIGUEL_PRO_SAMPLE_ANALYTICS = {
  ...SAMPLE_ANALYTICS,
  utilization: { overallUtilizationPercent: 63.8, seats: [] },
  sessionLength: { sessionCount: 174, averageSessionMinutes: 88.6 },
  breakStats: { breakCount: 67, averageBreakMinutes: 6.8 },
  outcomes: {
    totalCount: 196,
    outcomes: [
      { status: 'COMPLETED', count: 174 },
      { status: 'CANCELLED', count: 11 },
      { status: 'VOIDED', count: 5 },
      { status: 'FORFEITED', count: 4 },
      { status: 'EVICTED', count: 2 },
    ],
  },
  noShowRate: { totalReservations: 196, cancelledCount: 11, noShowRatePercent: 5.6 },
};

const SAMPLE_ANALYTICS_BY_BUILDING = {
  gisbert: SAMPLE_ANALYTICS,
  miguel_pro: MIGUEL_PRO_SAMPLE_ANALYTICS,
};

const OUTCOME_STYLES = {
  COMPLETED: { label: 'Completed', color: 'bg-emerald-600' },
  CANCELLED: { label: 'No show', color: 'bg-amber-500' },
  VOIDED: { label: 'Voided', color: 'bg-slate-500' },
  FORFEITED: { label: 'Break expired', color: 'bg-red-600' },
  EVICTED: { label: 'Evicted', color: 'bg-violet-600' },
};

export default function AdminDashboard() {
  const { user, canUseProtectedApi } = useAuth();
  const [rangeDays, setRangeDays] = useState(30);
  const [buildingFilter, setBuildingFilter] = useState('gisbert');
  const [areaFilter, setAreaFilter] = useState('all');
  const [analytics, setAnalytics] = useState(SAMPLE_ANALYTICS);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [usingSampleData, setUsingSampleData] = useState(!canUseProtectedApi);
  const [ghostReports, setGhostReports] = useState([]);

  const selectedLibrary = LIBRARIES[buildingFilter];
  const selectedSampleAnalytics = SAMPLE_ANALYTICS_BY_BUILDING[buildingFilter];

  useEffect(() => {
    if (!canUseProtectedApi || buildingFilter === 'miguel_pro') {
      setAnalytics(selectedSampleAnalytics);
      setUsingSampleData(true);
      setLoadError('');
      return undefined;
    }

    const controller = new AbortController();
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      building: buildingFilter,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    if (areaFilter !== 'all') params.set('floor', areaFilter);

    async function loadAnalytics() {
      setLoading(true);
      setLoadError('');
      try {
        const query = params.toString();
        const [utilization, peakHours, outcomes, noShowRate, sessionLength, breakStats] = await Promise.all([
          apiClient(`/api/analytics/utilization?${query}`, { signal: controller.signal }),
          apiClient(`/api/analytics/peak-hours?${query}`, { signal: controller.signal }),
          apiClient(`/api/analytics/outcomes?${query}`, { signal: controller.signal }),
          apiClient(`/api/analytics/no-show-rate?${query}`, { signal: controller.signal }),
          apiClient(`/api/analytics/session-length?${query}`, { signal: controller.signal }),
          apiClient(`/api/analytics/break-stats?${query}`, { signal: controller.signal }),
        ]);
        setAnalytics({ utilization, peakHours, outcomes, noShowRate, sessionLength, breakStats });
        setUsingSampleData(false);
      } catch (error) {
        if (error.name === 'AbortError') return;
        setAnalytics(selectedSampleAnalytics);
        setUsingSampleData(true);
        setLoadError('Live analytics are unavailable, so the dashboard is showing the labeled sample dataset.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAnalytics();
    return () => controller.abort();
  }, [areaFilter, buildingFilter, canUseProtectedApi, rangeDays, selectedSampleAnalytics]);

  useEffect(() => {
    const token = getToken();
    if (!token || !canUseProtectedApi) return undefined;

    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on('seat_flagged_admin_notice', (report) => {
      setGhostReports((current) => [
        {
          ...report,
          reportedAt: report.reportedAt || new Date().toISOString(),
          windowSeconds: report.windowSeconds || 600,
        },
        ...current.filter((item) => item.reservationId !== report.reservationId),
      ].slice(0, 20));
    });
    socket.on('seat_flag_resolved_admin_notice', ({ reservationId }) => {
      setGhostReports((current) => current.filter((item) => item.reservationId !== reservationId));
    });
    return () => socket.disconnect();
  }, [canUseProtectedApi]);

  const demandRows = useMemo(() => {
    if (usingSampleData || !analytics.utilization?.seats?.length) {
      return selectedLibrary.sampleAreas.filter((item) => areaFilter === 'all' || item.id === areaFilter);
    }
    return summarizeFloors(analytics.utilization.seats);
  }, [analytics.utilization, areaFilter, selectedLibrary, usingSampleData]);

  const peakHour = useMemo(() => {
    const hours = analytics.peakHours?.hours || [];
    return hours.reduce(
      (peak, item) => item.utilizationPercent > peak.utilizationPercent ? item : peak,
      { hour: 0, utilizationPercent: 0 },
    );
  }, [analytics.peakHours]);

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

      {(usingSampleData || loadError) && (
        <div className="ui-alert-info mt-6 flex items-start gap-3">
          <WarningCircle size={20} weight="duotone" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Sample analytics workspace</p>
            <p className="mt-1 text-sm">
              {loadError || (buildingFilter === 'miguel_pro'
                ? 'Miguel Pro figures are representative demo data while live area-level analytics remain pending.'
                : 'These figures are representative demo data. Front-desk actions still use this browser\'s reservation records.')}
            </p>
          </div>
        </div>
      )}

      <section className="ui-panel mt-6 overflow-hidden" aria-label="Ghost-seat reports">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-red-50 text-red-700"><WarningCircle size={20} weight="duotone" /></span>
            <div>
              <h2 className="ui-section-title">Ghost-seat reports</h2>
              <p className="mt-1 text-xs text-slate-500">Students can report an occupied node that appears physically vacant.</p>
            </div>
          </div>
          <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${ghostReports.length ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {ghostReports.length ? `${ghostReports.length} active` : 'No active reports'}
          </span>
        </div>
        <div className="p-5">
          {ghostReports.length ? (
            <div className="space-y-3">
              {ghostReports.map((report) => (
                <div key={report.reservationId} className="flex flex-col justify-between gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-semibold text-red-950">Reported vacant node {formatSeatReference(report.seatId)}</p>
                    <p className="mt-1 text-sm text-red-800">
                      {formatBuildingName(report.building)}{report.floor ? ` · Floor ${report.floor}` : ''} · Holder has {Math.round((report.windowSeconds || 600) / 60)} minutes to re-verify at the physical QR.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.building && report.floor && (
                      <Link to={`/map/${report.building}/${report.floor}`} className="ui-button-secondary py-2 text-xs">Open map</Link>
                    )}
                    <button type="button" onClick={() => setGhostReports((current) => current.filter((item) => item.reservationId !== report.reservationId))} className="ui-icon-button" aria-label="Dismiss ghost-seat report"><X size={17} weight="bold" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
              New reports appear here immediately. The reservation holder is notified and must scan the designated physical QR to retain the reservation.
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 py-6 sm:flex-row sm:items-end sm:justify-between" aria-label="Analytics filters">
        <div>
          <h2 className="ui-section-title">Usage patterns</h2>
          <p className="mt-1 text-sm text-slate-500">Historical occupancy logs, not current seat availability.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:flex">
          <FilterSelect label="Date range" value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))}>
            {DATE_RANGES.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
          </FilterSelect>
          <FilterSelect label="Library" value={buildingFilter} onChange={(event) => { setBuildingFilter(event.target.value); setAreaFilter('all'); }}>
            <option value="gisbert">Gisbert Library</option>
            <option value="miguel_pro">Miguel Pro</option>
          </FilterSelect>
          <FilterSelect label={selectedLibrary.filterLabel} value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
            <option value="all">{selectedLibrary.allLabel}</option>
            {selectedLibrary.sampleAreas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
          </FilterSelect>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Analytics summary">
        <Metric
          icon={TrendUp}
          label="Average utilization"
          value={`${formatNumber(analytics.utilization?.overallUtilizationPercent)}%`}
          detail={areaFilter === 'all' ? `Across ${selectedLibrary.name}` : selectedLibrary.sampleAreas.find((area) => area.id === areaFilter)?.label}
          tone="blue"
          loading={loading}
        />
        <Metric
          icon={Clock}
          label="Peak usage"
          value={formatHour(peakHour.hour)}
          detail={`${formatNumber(peakHour.utilizationPercent)}% utilization`}
          tone="amber"
          loading={loading}
        />
        <Metric
          icon={ChartBar}
          label="Average session"
          value={formatDuration(analytics.sessionLength?.averageSessionMinutes)}
          detail={`${analytics.sessionLength?.sessionCount || 0} completed sessions`}
          tone="green"
          loading={loading}
        />
        <Metric
          icon={Coffee}
          label="Recorded breaks"
          value={analytics.breakStats?.breakCount || 0}
          detail={`${formatNumber(analytics.breakStats?.averageBreakMinutes)} min average`}
          tone="violet"
          loading={loading}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <article className="ui-panel overflow-hidden">
          <PanelHeader
            icon={Clock}
            title="Peak occupancy by hour"
            description="Average utilization across the selected period"
          />
          <div className="p-5">
            <HourlyChart hours={analytics.peakHours?.hours || []} loading={loading} />
          </div>
        </article>

        <article className="ui-panel overflow-hidden">
          <PanelHeader
            icon={MapTrifold}
            title={selectedLibrary.demandTitle}
            description={selectedLibrary.demandDescription}
          />
          <div className="p-5">
            <div className="space-y-5">
              {demandRows.map((item) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold text-slate-900">{item.label}</span>
                    <span className="font-mono font-semibold text-[#063a64]">{formatNumber(item.utilization)}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-sm bg-slate-100" aria-hidden="true">
                    <div className="h-full rounded-sm bg-[#0c6097]" style={{ width: `${Math.min(100, item.utilization)}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.capacity} mapped nodes</span>
                    <Link to={item.mapPath} className="font-semibold text-[#063a64] hover:underline">Open map</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="ui-panel overflow-hidden">
          <PanelHeader
            icon={ChartBar}
            title="Reservation outcomes"
            description="Completed sessions and integrity-related releases"
          />
          <div className="p-5">
            <OutcomeChart report={analytics.outcomes} />
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
              <DataPoint label="No-show rate" value={`${formatNumber(analytics.noShowRate?.noShowRatePercent)}%`} />
              <DataPoint label="No-show count" value={analytics.noShowRate?.cancelledCount || 0} />
            </div>
          </div>
        </article>

        <article className="ui-panel overflow-hidden">
          <PanelHeader
            icon={LockKey}
            title="Predictive occupancy"
            description="Research-target forecasting readiness"
          />
          <div className="p-5">
            <div className="rounded-[8px] border border-slate-200 bg-[#f5f9fc] p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-white text-[#063a64] shadow-sm">
                  <CalendarBlank size={22} weight="duotone" />
                </span>
                <div>
                  <p className="font-semibold text-slate-950">Waiting for sufficient live data</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Forecasting activates only after at least two weeks of continuous occupancy logs. Demo values are not used to train predictions.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ModelNote title="SARIMA" copy="Seven-day hourly forecast with a 95% confidence interval." />
              <ModelNote title="GBDT / XGBoost" copy="Peak-hour heatmap using calendar, building, and floor context." />
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Link to="/frontdesk" className="ui-panel group flex items-center justify-between gap-5 p-5 hover:-translate-y-0.5 hover:border-blue-300">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#e6f0f7] text-[#063a64]"><Monitor size={23} weight="duotone" /></span>
            <span><span className="block font-semibold text-slate-950">Entry verification</span><span className="mt-1 block text-sm text-slate-600">Review pending student reservations.</span></span>
          </div>
          <ArrowRight size={20} weight="bold" className="shrink-0 text-slate-400 group-hover:translate-x-1 group-hover:text-[#063a64]" />
        </Link>
        <Link to="/" className="ui-panel group flex items-center justify-between gap-5 p-5 hover:-translate-y-0.5 hover:border-blue-300">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-slate-100 text-[#063a64]"><MapTrifold size={23} weight="duotone" /></span>
            <span><span className="block font-semibold text-slate-950">Library maps</span><span className="mt-1 block text-sm text-slate-600">Inspect Gisbert floors and Miguel Pro areas.</span></span>
          </div>
          <ArrowRight size={20} weight="bold" className="shrink-0 text-slate-400 group-hover:translate-x-1 group-hover:text-[#063a64]" />
        </Link>
      </section>
    </Layout>
  );
}

function summarizeFloors(seats) {
  const totals = new Map();
  seats.forEach((seat) => {
    const current = totals.get(seat.floor) || { floor: seat.floor, capacity: 0, total: 0 };
    current.capacity += 1;
    current.total += Number(seat.utilizationPercent) || 0;
    totals.set(seat.floor, current);
  });
  return [...totals.values()]
    .map((item) => ({
      ...item,
      id: String(item.floor),
      label: `Floor ${item.floor}`,
      mapPath: `/map/gisbert/${item.floor}`,
      utilization: item.capacity ? item.total / item.capacity : 0,
    }))
    .sort((a, b) => a.floor - b.floor);
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
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${accents[tone]}`}><Icon size={22} weight="duotone" /></span>
      </div>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 bg-white/95 px-5 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#e6f0f7] text-[#063a64]"><Icon size={20} weight="duotone" /></span>
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
              <span className="sr-only">{formatHour(item.hour)}: {formatNumber(item.utilizationPercent)}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-500">
        <span>{formatHour(hours[0].hour)}</span>
        <span>{formatHour(hours[Math.floor(hours.length / 2)].hour)}</span>
        <span>{formatHour(hours[hours.length - 1].hour)}</span>
      </div>
    </div>
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
          const style = OUTCOME_STYLES[outcome.status] || { label: outcome.status, color: 'bg-slate-400' };
          return <div key={outcome.status} className={style.color} style={{ width: `${outcome.count / total * 100}%` }} title={`${style.label}: ${outcome.count}`} />;
        })}
      </div>
      <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {outcomes.map((outcome) => {
          const style = OUTCOME_STYLES[outcome.status] || { label: outcome.status, color: 'bg-slate-400' };
          return (
            <div key={outcome.status} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-sm ${style.color}`} />{style.label}</span>
              <span className="font-mono font-semibold text-slate-950">{outcome.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataPoint({ label, value }) {
  return <div><p className="ui-label">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>;
}

function ModelNote({ title, copy }) {
  return <div><p className="text-sm font-semibold text-slate-950">{title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p></div>;
}

function EmptyState({ copy }) {
  return <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">{copy}</div>;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHour(hour) {
  return new Date(2000, 0, 1, hour || 0).toLocaleTimeString([], { hour: 'numeric' });
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
