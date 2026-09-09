import { Link } from 'react-router-dom';
import { ArrowRight, Buildings, MapTrifold, Monitor, WarningCircle } from '@phosphor-icons/react';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getGisbertPreviewSeats } from '../data/gisbertPreviewSeats.js';

const UTILIZATION = [62, 48, 71, 55];
const FLOOR_DATA = [1, 2, 3, 4].map((floor, index) => {
  const capacity = getGisbertPreviewSeats(floor).length;
  const occupied = Math.round(capacity * UTILIZATION[index] / 100);
  return { floor, capacity, occupied, available: capacity - occupied, utilization: UTILIZATION[index] };
});

const TOTAL_CAPACITY = FLOOR_DATA.reduce((sum, floor) => sum + floor.capacity, 0);
const TOTAL_OCCUPIED = FLOOR_DATA.reduce((sum, floor) => sum + floor.occupied, 0);

export default function AdminDashboard() {
  const { user, canUseProtectedApi } = useAuth();
  const totalAvailable = TOTAL_CAPACITY - TOTAL_OCCUPIED;

  return (
    <Layout>
      <section className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
            <Buildings size={18} weight="fill" />
            Gisbert Library
          </div>
          <h1 className="ui-page-title">Operations overview</h1>
          <p className="ui-muted mt-2">Current floor capacity and front-desk activity for {user?.name}.</p>
        </div>
        <Link to="/frontdesk" className="ui-button-primary self-start">
          <Monitor size={18} weight="bold" />
          Open front desk
        </Link>
      </section>

      {!canUseProtectedApi && (
        <div className="mt-6 flex items-start gap-3 border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <WarningCircle size={20} weight="duotone" className="mt-0.5 shrink-0" />
          Sample workspace is active. Occupancy figures below are representative, while front-desk actions use this browser's reservation data.
        </div>
      )}

      <section className="grid gap-3 py-6 sm:grid-cols-2 xl:grid-cols-4" aria-label="Occupancy summary">
        <Metric label="Mapped nodes" value={TOTAL_CAPACITY} detail="Four floors" tone="blue" />
        <Metric label="In use" value={TOTAL_OCCUPIED} detail={`${Math.round(TOTAL_OCCUPIED / TOTAL_CAPACITY * 100)}% utilization`} tone="red" />
        <Metric label="Available" value={totalAvailable} detail={`${Math.round(totalAvailable / TOTAL_CAPACITY * 100)}% remaining`} tone="green" />
        <Metric label="Needs review" value="3" detail="Flagged nodes" tone="amber" />
      </section>

      <section className="ui-panel overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="ui-section-title">Floor status</h2>
            <p className="mt-1 text-xs text-slate-500">Gisbert Library sample occupancy</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            Operational
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-[#f7f9fb] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Floor</th>
                <th className="px-5 py-3 font-semibold">Capacity</th>
                <th className="px-5 py-3 font-semibold">In use</th>
                <th className="px-5 py-3 font-semibold">Available</th>
                <th className="px-5 py-3 font-semibold">Utilization</th>
                <th className="px-5 py-3 text-right font-semibold">Floor plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FLOOR_DATA.map((item) => (
                <tr key={item.floor} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 font-semibold text-slate-950">
                      <span className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-xs text-[#073b66]">{item.floor}</span>
                      Floor {item.floor}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{item.capacity}</td>
                  <td className="px-5 py-4 text-slate-600">{item.occupied}</td>
                  <td className="px-5 py-4 font-semibold text-emerald-700">{item.available}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-32 overflow-hidden rounded-sm bg-slate-200" aria-hidden="true">
                        <div className="h-full bg-[#073b66]" style={{ width: `${item.utilization}%` }} />
                      </div>
                      <span className="w-9 text-right text-xs font-semibold text-slate-600">{item.utilization}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link to={`/map/gisbert/${item.floor}`} className="inline-flex items-center gap-2 font-semibold text-[#073b66] hover:underline">
                      Open map
                      <ArrowRight size={16} weight="bold" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <Link to="/frontdesk" className="ui-panel group flex items-center justify-between gap-5 p-5 hover:border-blue-300">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-blue-50 text-[#073b66]"><Monitor size={23} weight="duotone" /></span>
            <span><span className="block font-semibold text-slate-950">Entry verification</span><span className="mt-1 block text-sm text-slate-600">Review pending student reservations.</span></span>
          </div>
          <ArrowRight size={20} weight="bold" className="shrink-0 text-slate-400 group-hover:translate-x-1 group-hover:text-[#073b66]" />
        </Link>
        <Link to="/" className="ui-panel group flex items-center justify-between gap-5 p-5 hover:border-blue-300">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-slate-100 text-[#073b66]"><MapTrifold size={23} weight="duotone" /></span>
            <span><span className="block font-semibold text-slate-950">Floor maps</span><span className="mt-1 block text-sm text-slate-600">Inspect all mapped reservation nodes.</span></span>
          </div>
          <ArrowRight size={20} weight="bold" className="shrink-0 text-slate-400 group-hover:translate-x-1 group-hover:text-[#073b66]" />
        </Link>
      </section>
    </Layout>
  );
}

function Metric({ label, value, detail, tone }) {
  const accents = { blue: 'bg-[#073b66]', red: 'bg-red-600', green: 'bg-emerald-600', amber: 'bg-amber-500' };
  return (
    <div className="ui-panel overflow-hidden">
      <div className={`h-1 ${accents[tone]}`} />
      <div className="p-5">
        <p className="ui-label">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
        <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
      </div>
    </div>
  );
}
