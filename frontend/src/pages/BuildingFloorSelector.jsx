import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Buildings, Clock, MapPin, Ticket } from '@phosphor-icons/react';
import { apiClient } from '../api/client.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getGisbertPreviewSeats } from '../data/gisbertPreviewSeats.js';
import { getDemoReservation, subscribeToDemoReservation } from '../data/demoReservationStore.js';

const GISBERT_FLOORS = [
  { floor: 1, name: 'Commons and services' },
  { floor: 2, name: 'Reading hall' },
  { floor: 3, name: 'Collaborative study' },
  { floor: 4, name: 'Quiet study' },
];

export default function BuildingFloorSelector() {
  const [building, setBuilding] = useState('gisbert');
  const [activeReservation, setActiveReservation] = useState(null);
  const navigate = useNavigate();
  const { user, canUseProtectedApi } = useAuth();

  const floorOptions = useMemo(
    () => GISBERT_FLOORS.map((option) => ({
      ...option,
      capacity: getGisbertPreviewSeats(option.floor).length,
    })),
    [],
  );

  const totalSeats = floorOptions.reduce((sum, option) => sum + option.capacity, 0);

  useEffect(() => {
    if (!user) {
      setActiveReservation(null);
      return undefined;
    }

    if (!canUseProtectedApi) {
      const refreshDemoReservation = () => setActiveReservation(getDemoReservation());
      refreshDemoReservation();
      return subscribeToDemoReservation(refreshDemoReservation);
    }

    apiClient('/api/reservations/me/current')
      .then((data) => setActiveReservation(data.reservation))
      .catch(() => setActiveReservation(null));
    return undefined;
  }, [user, canUseProtectedApi]);

  const openActiveReservation = () => {
    if (!activeReservation) return;
    navigate('/receipt', {
      state: {
        reservation: activeReservation,
        qrToken: activeReservation.qrToken || activeReservation.seat?.currentQrToken || null,
        isDemo: !canUseProtectedApi,
      },
    });
  };

  const firstName = user?.name?.split(' ')[0];
  const libraryStats = [
    { label: 'Mapped nodes', value: totalSeats },
    { label: 'Gisbert floors', value: floorOptions.length },
    { label: 'Guest browsing', value: 'Open' },
  ];

  return (
    <Layout>
      <section className="overflow-hidden rounded-[8px] bg-[linear-gradient(135deg,#032946_0%,#063a64_58%,#0b4d7a_100%)] text-white shadow-[0_24px_70px_rgba(3,41,70,0.24)]">
        <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-[8px] bg-white/10 px-3 py-2 text-sm font-semibold text-amber-100">
              <MapPin size={18} weight="fill" />
              Gisbert Library
            </div>
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-5xl">
              Find the right study node before you walk in.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100/82 sm:text-base">
              {user?.role === 'student'
                ? `${firstName ? `${firstName}, ` : ''}select a floor and reserve from the live map.`
                : 'Browse formal seating across Gisbert Library without signing in.'}
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-3 overflow-hidden rounded-[8px] border border-white/15 bg-white/10">
              {libraryStats.map((item) => (
                <div key={item.label} className="border-r border-white/10 px-4 py-4 last:border-r-0">
                  <p className="text-xl font-semibold text-white sm:text-2xl">{item.value}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase text-blue-100/66">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="inline-flex w-full rounded-[8px] border border-white/15 bg-white/10 p-1" aria-label="Library location">
              <button type="button" onClick={() => setBuilding('gisbert')} className={`min-h-11 flex-1 rounded-[6px] px-4 text-sm font-semibold ${building === 'gisbert' ? 'bg-white text-[#063a64] shadow-[0_10px_24px_rgba(3,41,70,0.18)]' : 'text-blue-100/82 hover:bg-white/10 hover:text-white'}`}>
                Gisbert
              </button>
              <button type="button" onClick={() => setBuilding('miguel_pro')} className={`min-h-11 flex-1 rounded-[6px] px-4 text-sm font-semibold ${building === 'miguel_pro' ? 'bg-white text-[#063a64] shadow-[0_10px_24px_rgba(3,41,70,0.18)]' : 'text-blue-100/82 hover:bg-white/10 hover:text-white'}`}>
                Miguel Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {activeReservation && (
        <section className="ui-alert-warning mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Ticket size={22} weight="duotone" className="mt-0.5 shrink-0 text-amber-800" />
            <div>
              <p className="font-semibold text-amber-950">Reservation in progress</p>
              <p className="mt-1 text-sm text-amber-800">{activeReservation.seat?.label || 'Study node'} · {activeReservation.status.replace('_', ' ')}</p>
            </div>
          </div>
          <button type="button" onClick={openActiveReservation} className="ui-button-secondary self-start border-amber-300 text-amber-900 hover:bg-amber-100">
            Open reservation
            <ArrowRight size={17} weight="bold" />
          </button>
        </section>
      )}

      {user && !canUseProtectedApi && !activeReservation && (
        <div className="ui-alert-info mt-6 flex items-center gap-3">
          <Clock size={19} weight="duotone" className="shrink-0" />
          Sample mode is active. Reservations remain in this browser.
        </div>
      )}

      {building === 'gisbert' ? (
        <section className="pt-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="ui-section-title">Gisbert floors</h2>
              <p className="mt-1 text-sm text-slate-500">{totalSeats} mapped reservation nodes</p>
            </div>
            <Buildings size={30} weight="duotone" className="text-[#063a64]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {floorOptions.map(({ floor, name, capacity }) => (
              <button key={floor} type="button" onClick={() => navigate(`/map/gisbert/${floor}`)} className="floor-card group min-h-56 overflow-hidden">
                <span className="flex h-full flex-col p-5">
                  <span className="flex items-start justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-[8px] bg-[#063a64] text-lg font-semibold text-white shadow-[0_12px_28px_rgba(6,58,100,0.2)]">{floor}</span>
                    <ArrowRight size={20} weight="bold" className="mt-1 text-slate-400 group-hover:translate-x-1 group-hover:text-[#063a64]" />
                  </span>
                  <span className="mt-5 block overflow-hidden rounded-[8px] border border-slate-200 bg-[#f4f8fb] p-3">
                    <span className="block h-2 rounded-sm bg-[#dce8f0]">
                      <span className="block h-full rounded-sm bg-[#063a64]" style={{ width: `${Math.max(42, Math.round(capacity / totalSeats * 100 * 2.2))}%` }} />
                    </span>
                    <span className="mt-3 grid grid-cols-3 gap-2">
                      <span className="h-9 rounded-[6px] bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.35)]" />
                      <span className="h-9 rounded-[6px] bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.35)]" />
                      <span className="h-9 rounded-[6px] bg-[#fff7df] shadow-[inset_0_0_0_1px_rgba(196,154,34,0.32)]" />
                    </span>
                  </span>
                  <span className="mt-5 block text-base font-semibold text-slate-950">Floor {floor}</span>
                  <span className="mt-1 block text-sm text-slate-600">{name}</span>
                  <span className="mt-auto block pt-4 text-xs font-semibold text-slate-500">{capacity} mapped nodes</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="py-10">
          <div className="ui-panel flex max-w-2xl items-start gap-4 p-6">
            <Buildings size={30} weight="duotone" className="shrink-0 text-[#063a64]" />
            <div>
              <h2 className="ui-section-title">Miguel Pro Learning Commons</h2>
              <p className="ui-muted mt-2">Floor plans are being prepared. Gisbert Library remains available for reservations.</p>
              <button type="button" onClick={() => setBuilding('gisbert')} className="ui-button-secondary mt-5">Return to Gisbert</button>
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}
