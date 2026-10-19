import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Buildings, CheckCircle, Clock, Flag, MapPin, QrCode, SignOut, Ticket } from '@phosphor-icons/react';
import { apiClient } from '../api/client.js';
import { normalizeReservation } from '../api/normalizers.js';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { getGisbertPreviewSeats } from '../data/gisbertPreviewSeats.js';
import { getMiguelProPreviewSeats } from '../data/miguelProMap.js';

const GISBERT_FLOORS = [
  { floor: 1, name: 'Commons and services' },
  { floor: 2, name: 'Reading hall' },
  { floor: 3, name: 'Collaborative study' },
  { floor: 4, name: 'Quiet study' },
];

const LIBRARIES = {
  gisbert: {
    name: 'Gisbert Library',
    shortName: 'Gisbert',
    unitLabel: 'floors',
    statLabel: 'Mapped floors',
    statValue: 4,
    floors: GISBERT_FLOORS,
    getSeats: getGisbertPreviewSeats,
  },
  miguel_pro: {
    name: 'Miguel Pro Learning Commons',
    shortName: 'Miguel Pro',
    unitLabel: 'rooms',
    statLabel: 'Mapped rooms',
    statValue: 3,
    floors: [{ floor: 1, name: 'Main Area, Research Nook, and Workspace Room' }],
    getSeats: getMiguelProPreviewSeats,
  },
};

export default function BuildingFloorSelector() {
  const [building, setBuilding] = useState('gisbert');
  const [activeReservation, setActiveReservation] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { voidedReservation } = useNotifications();
  const voidedReservationIdRef = useRef(voidedReservation?.reservationId);
  voidedReservationIdRef.current = voidedReservation?.reservationId;

  const selectedLibrary = LIBRARIES[building];
  const floorOptions = useMemo(
    () => selectedLibrary.floors.map((option) => ({
      ...option,
      capacity: selectedLibrary.getSeats(option.floor).length,
    })),
    [selectedLibrary],
  );

  const totalSeats = floorOptions.reduce((sum, option) => sum + option.capacity, 0);

  useEffect(() => {
    if (!user) {
      setActiveReservation(null);
      return undefined;
    }

    apiClient('/api/reservations/me/current')
      .then((data) => {
        const current = normalizeReservation(data, { user });
        setActiveReservation(current?.reservationId === voidedReservationIdRef.current ? null : current);
      })
      .catch(() => setActiveReservation(null));
    return undefined;
  }, [user]);

  useEffect(() => {
    if (!voidedReservation?.reservationId) return;
    setActiveReservation((current) => current?.reservationId === voidedReservation.reservationId ? null : current);
  }, [voidedReservation]);

  const openActiveReservation = () => {
    if (!activeReservation) return;
    navigate('/receipt', {
      state: {
        reservation: activeReservation,
        qrToken: activeReservation.qrToken || activeReservation.seat?.currentQrToken || null,
      },
    });
  };

  const firstName = user?.name?.split(' ')[0];
  const libraryStats = [
    { label: 'Mapped seats', value: totalSeats },
    { label: selectedLibrary.statLabel, value: selectedLibrary.statValue },
    { label: 'Guest browsing', value: 'Open' },
  ];

  const reservationSteps = [
    {
      icon: Buildings,
      title: 'Sign in with your AdDU account',
      description: 'Open addu-seats.vercel.app. You can explore the maps as a guest, then sign in when you are ready to reserve.',
    },
    {
      icon: QrCode,
      title: 'Scan the reservation QR at the seat',
      description: 'Find the physical QR label with the blue highlight along its bottom edge.',
    },
    {
      icon: Ticket,
      title: 'Tap Reserve for the scanned seat',
      description: 'The seat is held for five minutes while you complete front-desk verification.',
    },
    {
      icon: CheckCircle,
      title: 'Show your code at the front desk',
      description: 'Present your receipt code and university ID within five minutes. Your seat is reserved once the front desk approves it.',
    },
  ];

  return (
    <Layout>
      <section className="overflow-hidden rounded-[8px] bg-[linear-gradient(135deg,#032946_0%,#063a64_58%,#0b4d7a_100%)] text-white shadow-[0_24px_70px_rgba(3,41,70,0.24)]">
        <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-[8px] bg-white/10 px-3 py-2 text-sm font-semibold text-amber-100">
              <MapPin size={18} weight="fill" />
              {selectedLibrary.name}
            </div>
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-5xl">
              Find the right study seat before you walk in.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100/82 sm:text-base">
              {user?.role === 'student'
                ? `${firstName ? `${firstName}, ` : ''}explore a ${building === 'gisbert' ? 'floor' : 'room'}, then scan the QR at your chosen seat to reserve.`
                : `Browse formal seating across ${selectedLibrary.name} without signing in.`}
            </p>
            <a href="#how-it-works" className="mt-6 inline-flex min-h-10 items-center gap-2 border-b border-amber-200/70 pb-1 text-sm font-semibold text-amber-100 hover:border-white hover:text-white">
              How to use AdDU Seats
              <ArrowRight size={17} weight="bold" />
            </a>
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
              <p className="mt-1 text-sm text-amber-800">{activeReservation.seat?.label || 'Study seat'} · {activeReservation.status.replace('_', ' ')}</p>
            </div>
          </div>
          <button type="button" onClick={openActiveReservation} className="ui-button-secondary self-start border-amber-300 text-amber-900 hover:bg-amber-100">
            Open reservation
            <ArrowRight size={17} weight="bold" />
          </button>
        </section>
      )}

      <section className="pt-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="ui-section-title">{selectedLibrary.shortName} {selectedLibrary.unitLabel}</h2>
            <p className="mt-1 text-sm text-slate-500">{totalSeats} mapped seats</p>
          </div>
          <Buildings size={30} weight="duotone" className="text-[#063a64]" />
        </div>

        <div className={building === 'gisbert' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4' : 'grid max-w-2xl gap-4'}>
          {floorOptions.map(({ floor, name, capacity }) => (
            <button key={floor} type="button" onClick={() => navigate(building === 'miguel_pro' ? `/map/${building}/${floor}?area=main_area` : `/map/${building}/${floor}`)} className="floor-card group min-h-56 overflow-hidden">
              <span className="flex h-full flex-col p-5">
                <span className="flex items-start justify-between gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-[8px] bg-[#063a64] text-lg font-semibold text-white shadow-[0_12px_28px_rgba(6,58,100,0.2)]">{floor}</span>
                  <ArrowRight size={20} weight="bold" className="mt-1 text-slate-400 group-hover:translate-x-1 group-hover:text-[#063a64]" />
                </span>
                <span className="mt-5 block overflow-hidden rounded-[8px] border border-slate-200 bg-[#f4f8fb] p-3">
                  <span className="block h-2 rounded-sm bg-[#dce8f0]">
                    <span className="block h-full rounded-sm bg-[#063a64]" style={{ width: `${Math.max(42, Math.min(100, Math.round(capacity / totalSeats * 100 * 2.2)))}%` }} />
                  </span>
                  <span className="mt-3 grid grid-cols-3 gap-2">
                    <span className="h-9 rounded-[6px] bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.35)]" />
                    <span className="h-9 rounded-[6px] bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.35)]" />
                    <span className="h-9 rounded-[6px] bg-[#fff7df] shadow-[inset_0_0_0_1px_rgba(196,154,34,0.32)]" />
                  </span>
                </span>
                <span className="mt-5 block text-base font-semibold text-slate-950">{building === 'gisbert' ? `Floor ${floor}` : 'Room maps'}</span>
                <span className="mt-1 block text-sm text-slate-600">{name}</span>
                <span className="mt-auto block pt-4 text-xs font-semibold text-slate-500">{capacity} mapped seats</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mt-16 scroll-mt-28 pb-6 sm:mt-20" aria-labelledby="how-it-works-title">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[#8a6b11]">How to use AdDU Seats</p>
          <h2 id="how-it-works-title" className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-[#032946] sm:text-4xl">Find a seat. Make it yours.</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">The map helps you choose. A scan at the physical seat starts the reservation.</p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
          <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(14,35,56,0.06)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-950">To reserve a seat</h3>
              {!user && <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#063a64] hover:text-[#032946]">Sign in <ArrowRight size={16} weight="bold" /></Link>}
            </div>
            <ol className="mt-5">
              {reservationSteps.map(({ icon: Icon, title, description }) => (
                <li key={title} className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 border-t border-slate-100 py-4 first:border-t-0 first:pt-0 last:pb-0">
                  <span className="grid h-11 w-11 place-items-center rounded-[8px] bg-[#e6f0f7] text-[#063a64]" aria-hidden="true"><Icon size={23} weight="duotone" /></span>
                  <span>
                    <span className="block text-base font-semibold text-slate-950">{title}</span>
                    <span className="mt-1 block max-w-xl text-sm leading-6 text-slate-600">{description}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 flex items-start gap-2 rounded-[8px] bg-[#e6f0f7] px-4 py-3 text-sm font-semibold leading-6 text-[#063a64]"><CheckCircle size={21} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />After approval, the seat is reserved for you.</p>
          </div>

          <aside className="rounded-[8px] border border-[#cbdbe8] bg-[#edf4f9] p-5 sm:p-8" aria-labelledby="qr-guide-title">
            <h3 id="qr-guide-title" className="text-xl font-semibold text-[#032946]">Know which QR to scan</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Both labels are attached to the physical seat or table. Their markings tell you what each scan does.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="flex flex-col rounded-[8px] border border-[#bdd2e2] bg-white p-4 shadow-[0_12px_26px_rgba(6,58,100,0.06)]">
                <div className="grid h-28 place-items-center rounded-[6px] border border-slate-200 bg-slate-50 text-[#063a64]" aria-hidden="true"><QrCode size={73} weight="regular" /></div>
                <span className="mt-[-6px] block h-[6px] rounded-b-[6px] bg-[#1269aa]" aria-hidden="true" />
                <p className="mt-5 text-sm font-semibold text-[#032946]">Reservation QR</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Blue highlight at the bottom. Scan to reserve.</p>
              </div>
              <div className="flex flex-col rounded-[8px] border border-[#bdd2e2] bg-white p-4 shadow-[0_12px_26px_rgba(6,58,100,0.06)]">
                <div className="grid h-28 place-items-center rounded-[6px] border border-slate-200 bg-slate-50 text-[#063a64]" aria-hidden="true"><QrCode size={73} weight="regular" /></div>
                <span className="mt-[-6px] block h-[6px] rounded-b-[6px] bg-slate-50" aria-hidden="true" />
                <p className="mt-5 text-sm font-semibold text-[#032946]">Verify QR</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">No blue highlight. Scan when you return or need to confirm your presence.</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">QR illustrations show the label difference. They are not scannable codes.</p>
          </aside>
        </div>

        <div className="mt-14 max-w-2xl">
          <h3 className="text-2xl font-semibold tracking-tight text-[#032946] sm:text-3xl">While your seat is reserved</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600 sm:text-base">Leave for good, take a short break, or report a seat that appears empty.</p>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-[8px] bg-[#063a64] p-6 text-white shadow-[0_22px_52px_rgba(6,58,100,0.17)] sm:p-8">
            <Clock size={30} weight="duotone" className="text-amber-200" aria-hidden="true" />
            <h4 className="mt-5 text-2xl font-semibold">Take a break, keep your seat</h4>
            <p className="mt-2 max-w-xl text-sm leading-7 text-blue-100">Start the break timer from your reservation. You get five minutes to return and can extend it twice, for up to 15 minutes total.</p>
            <div className="mt-7 grid grid-cols-3 gap-2 border-y border-white/20 py-5 sm:gap-4">
              <div><strong className="block text-2xl font-semibold tabular-nums sm:text-3xl">5 min</strong><span className="mt-1 block text-xs leading-5 text-blue-100/80">Initial break</span></div>
              <div><strong className="block text-2xl font-semibold tabular-nums sm:text-3xl">10 min</strong><span className="mt-1 block text-xs leading-5 text-blue-100/80">First extension</span></div>
              <div><strong className="block text-2xl font-semibold tabular-nums sm:text-3xl">15 min</strong><span className="mt-1 block text-xs leading-5 text-blue-100/80">Final limit</span></div>
            </div>
            <p className="mt-5 text-sm leading-7 text-blue-100">To end your break, return to your seat and scan its <strong className="font-semibold text-white">verify QR</strong> before the timer expires. If you return on time after using all 15 minutes, a 30-minute cooldown starts.</p>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_16px_42px_rgba(14,35,56,0.06)] sm:p-7">
              <SignOut size={28} weight="duotone" className="text-[#063a64]" aria-hidden="true" />
              <h4 className="mt-4 text-lg font-semibold text-slate-950">Done studying?</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">Open your reservation and choose <strong className="font-semibold text-slate-800">Check out</strong> to end it and free the seat.</p>
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_16px_42px_rgba(14,35,56,0.06)] sm:p-7">
              <Flag size={28} weight="duotone" className="text-[#063a64]" aria-hidden="true" />
              <h4 className="mt-4 text-lg font-semibold text-slate-950">Seat looks empty?</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">If the map marks it occupied, flag the reservation. The owner must return and scan the verify QR before the countdown ends, or the seat is released.</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
