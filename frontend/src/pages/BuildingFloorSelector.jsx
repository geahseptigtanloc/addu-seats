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

  return (
    <Layout>
      <section className="grid gap-6 border-b border-slate-200 pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#073b66]">
            <MapPin size={18} weight="fill" />
            Gisbert Library
          </div>
          <h1 className="ui-page-title">Choose a floor</h1>
          <p className="ui-muted mt-2 max-w-2xl">
            {user?.role === 'student'
              ? `${firstName ? `${firstName}, ` : ''}select a floor to see every reservable study node.`
              : 'Review the mapped study nodes across the library.'}
          </p>
        </div>

        <div className="inline-flex w-full rounded-md border border-slate-300 bg-white p-1 sm:w-auto" aria-label="Library location">
          <button type="button" onClick={() => setBuilding('gisbert')} className={`min-h-10 flex-1 rounded px-4 text-sm font-semibold sm:flex-none ${building === 'gisbert' ? 'bg-[#073b66] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            Gisbert
          </button>
          <button type="button" onClick={() => setBuilding('miguel_pro')} className={`min-h-10 flex-1 rounded px-4 text-sm font-semibold sm:flex-none ${building === 'miguel_pro' ? 'bg-[#073b66] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            Miguel Pro
          </button>
        </div>
      </section>

      {activeReservation && (
        <section className="mt-6 flex flex-col justify-between gap-4 border-l-4 border-amber-500 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center">
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
        <div className="mt-6 flex items-center gap-3 border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <Clock size={19} weight="duotone" className="shrink-0" />
          Sample mode is active. Reservations remain in this browser.
        </div>
      )}

      {building === 'gisbert' ? (
        <section className="pt-7">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="ui-section-title">Gisbert floors</h2>
              <p className="mt-1 text-sm text-slate-500">{totalSeats} mapped reservation nodes</p>
            </div>
            <Buildings size={28} weight="duotone" className="text-slate-400" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {floorOptions.map(({ floor, name, capacity }) => (
              <button key={floor} type="button" onClick={() => navigate(`/map/gisbert/${floor}`)} className="group ui-panel min-h-44 overflow-hidden text-left hover:border-blue-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                <span className="flex h-full flex-col p-5">
                  <span className="flex items-start justify-between gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-md bg-[#073b66] text-lg font-semibold text-white">{floor}</span>
                    <ArrowRight size={20} weight="bold" className="mt-1 text-slate-400 group-hover:translate-x-1 group-hover:text-[#073b66]" />
                  </span>
                  <span className="mt-6 block text-base font-semibold text-slate-950">Floor {floor}</span>
                  <span className="mt-1 block text-sm text-slate-600">{name}</span>
                  <span className="mt-auto block pt-4 text-xs font-semibold text-slate-500">{capacity} seats mapped</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="py-10">
          <div className="ui-panel flex max-w-2xl items-start gap-4 p-6">
            <Buildings size={30} weight="duotone" className="shrink-0 text-slate-400" />
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
