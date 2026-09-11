import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import {
  ArrowLeft,
  CheckCircle,
  Coffee,
  Plus,
  QrCode,
  SignOut,
  Timer,
  Warning,
  X,
} from '@phosphor-icons/react';
import Layout from '../components/Layout.jsx';
import { apiClient, getToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getDemoReservation,
  subscribeToDemoReservation,
  updateDemoReservation,
} from '../data/demoReservationStore.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function formatTime(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function secondsUntil(value) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000));
}

function getNodeType(seatType) {
  if (seatType === 'table_node') return 'Collaborative table';
  if (seatType === 'cubicle') return 'Study cubicle';
  return 'Individual seat';
}

export default function ReservationReceipt() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, canUseProtectedApi } = useAuth();
  const [reservation, setReservation] = useState(location.state?.reservation || null);
  const [qrToken, setQrToken] = useState(location.state?.qrToken || null);
  const [busyAction, setBusyAction] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [flagMessage, setFlagMessage] = useState('');
  const [showBreakDialog, setShowBreakDialog] = useState(false);
  const [, setTick] = useState(0);

  const isDemo = Boolean(location.state?.isDemo || reservation?.demo || !canUseProtectedApi);

  useEffect(() => {
    async function refreshReservation() {
      if (isDemo) {
        const current = getDemoReservation({ includeTerminal: true });
        if (current) {
          setReservation(current);
          setQrToken(current.qrToken);
        }
        return;
      }

      try {
        const data = await apiClient('/api/reservations/me/current');
        setReservation(data.reservation);
        setQrToken(data.qrToken);
      } catch {
        // Keep the current receipt visible if the server has just moved it to a terminal state.
      }
    }

    refreshReservation();
    const unsubscribe = subscribeToDemoReservation(refreshReservation);
    const pollInterval = !isDemo ? setInterval(refreshReservation, 3000) : null;
    return () => {
      unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isDemo]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((tick) => tick + 1);
      if (isDemo) {
        const current = getDemoReservation({ includeTerminal: true });
        if (current) setReservation(current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isDemo]);

  useEffect(() => {
    const token = getToken();
    if (!token || !reservation || isDemo) return undefined;

    const socket = io(`${SOCKET_URL}/user`, { auth: { token } });
    socket.on('seat_flagged', (data) => {
      if (data.reservationId === reservation.reservationId) {
        setFlagged(true);
        setFlagMessage(data.message);
      }
    });
    socket.on('reservation_status_updated', (data) => {
      if (data.reservationId === reservation.reservationId) {
        setReservation((current) => ({ ...current, status: data.status }));
      }
    });
    socket.on('break_expired', () => {
      setReservation((current) => ({ ...current, status: 'expired' }));
    });
    socket.on('flag_expired', () => {
      setReservation((current) => ({ ...current, status: 'expired' }));
    });
    return () => socket.disconnect();
  }, [reservation?.reservationId, isDemo]);

  async function performAction(action, apiPath, options = {}) {
    setBusyAction(action);
    try {
      const updated = isDemo
        ? updateDemoReservation(reservation.reservationId, action, options)
        : await apiClient(apiPath, { method: 'POST' });
      setReservation(updated);
      return updated;
    } catch (err) {
      alert(err.message);
      return null;
    } finally {
      setBusyAction('');
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this pending reservation?')) return;
    setBusyAction('cancel');
    try {
      if (isDemo) {
        updateDemoReservation(reservation.reservationId, 'cancel');
      } else {
        await apiClient(`/api/reservations/${reservation.reservationId}`, { method: 'DELETE' });
      }
      navigate(`/map/${reservation.seat.building}/${reservation.seat.floor}`);
    } catch (err) {
      alert(err.message);
      setBusyAction('');
    }
  }

  async function handleCheckout() {
    if (!confirm('Check out and release this reservation node?')) return;
    const updated = await performAction(
      'checkout',
      `/api/reservations/${reservation.reservationId}/checkout`,
    );
    if (updated) navigate('/');
  }

  async function handleResolveFlag() {
    setBusyAction('resolve_flag');
    try {
      await apiClient(`/api/reservations/${reservation.reservationId}/resolve-flag`, { method: 'POST' });
      setFlagged(false);
      setFlagMessage('');
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyAction('');
    }
  }

  if (!reservation) {
    return (
      <Layout>
        <div className="mx-auto max-w-xl py-16">
          <div className="ui-panel p-8 text-center">
            <h1 className="text-xl font-bold text-slate-950">No reservation found</h1>
            <Link to="/" className="ui-button-primary mt-5">Return to seat maps</Link>
          </div>
        </div>
      </Layout>
    );
  }

  const entrySeconds = secondsUntil(reservation.entryDeadline);
  const breakSeconds = secondsUntil(reservation.breakDeadline);
  const cooldownSeconds = secondsUntil(reservation.cooldownUntil);
  const locallyExpired = reservation.status === 'pending_entry' && entrySeconds === 0;
  const status = locallyExpired ? 'expired' : reservation.status;
  const seat = reservation.seat || {};
  const nodeLabel = seat.label || 'Reserved node';
  const buildingName = (seat.building || 'gisbert').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const verificationUrl = qrToken
    ? `${window.location.origin}/verify?token=${encodeURIComponent(qrToken)}`
    : '';
  const sampleSeatQrUrl = `${window.location.origin}/seat-return/${encodeURIComponent(seat.seatId || '')}`;
  const allocatedBreakMinutes = reservation.breakMinutesUsed || 5;
  const breakProgress = Math.min(100, Math.max(0, (breakSeconds / (allocatedBreakMinutes * 60)) * 100));
  const breakIsUrgent = status === 'on_break' && breakSeconds <= 60;

  return (
    <Layout>
      <section className="mx-auto max-w-4xl">
        <div className="ui-surface-band flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end">
          <div>
            <p className="ui-kicker">Student reservation</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {status === 'pending_entry' ? 'Front-desk verification needed' : status === 'active' ? 'Study session active' : status === 'on_break' ? 'Break in progress' : 'Reservation update'}
            </h1>
          </div>
          <Link to={`/map/${seat.building || 'gisbert'}/${seat.floor || 1}`} className="inline-flex self-start items-center gap-2 text-sm font-semibold text-[#063a64] hover:underline">
            <ArrowLeft size={16} weight="bold" />
            Floor map
          </Link>
        </div>

        {isDemo && (
          <div className="ui-alert-info mt-5">
            Sample reservation: this record is saved only in this browser.
          </div>
        )}

        {flagged && (
          <div className="ui-alert-danger mt-5">
            <h2 className="font-semibold text-red-900">Your node was reported vacant</h2>
            <p className="mt-1 text-sm text-red-800">{flagMessage}</p>
            <button type="button" onClick={handleResolveFlag} disabled={busyAction === 'resolve_flag'} className="mt-3 rounded-[8px] bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
              Confirm presence
            </button>
          </div>
        )}

        <div className="grid gap-6 py-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <section className="ui-panel p-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                <Detail label="Reservation node" value={nodeLabel} emphasis />
                <Detail label="Node type" value={getNodeType(seat.seatType)} />
                <Detail label="Location" value={`${buildingName}, Floor ${seat.floor || '-'}`} />
                <Detail label="Student" value={user?.name || reservation.user?.name || 'Student'} />
                <Detail label="ID verification" value={`Ending in ${user?.adduIdLast4 || reservation.user?.adduIdLast4 || 'N/A'}`} />
                <Detail label="Reference" value={reservation.reservationId.slice(-8).toUpperCase()} mono />
              </div>
            </section>

            {status === 'pending_entry' && (
              <section className="rounded-[8px] border border-amber-200 bg-amber-50 p-5 shadow-[0_16px_44px_rgba(180,83,9,0.1)]">
                <p className="text-sm font-semibold text-amber-900">Present your receipt now</p>
                <p className="mt-2 text-sm text-amber-800">Show this QR code and your university ID at the front desk before the timer reaches zero.</p>
                <div className="mt-5 flex items-end justify-between gap-4 border-t border-amber-200 pt-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-amber-800">Time remaining</p>
                    <p className="mt-1 font-mono text-4xl font-bold text-amber-950">{formatTime(entrySeconds)}</p>
                  </div>
                  <button type="button" onClick={handleCancel} disabled={Boolean(busyAction)} className="rounded-[8px] px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                    {busyAction === 'cancel' ? 'Cancelling...' : 'Cancel reservation'}
                  </button>
                </div>
              </section>
            )}

            {status === 'active' && (
              <section className="overflow-hidden rounded-[8px] border border-green-200 bg-white shadow-[0_18px_48px_rgba(14,35,56,0.08)]">
                <div className="flex items-start gap-3 border-b border-green-100 bg-green-50 p-5">
                  <CheckCircle size={26} weight="fill" className="shrink-0 text-green-700" />
                  <div>
                    <p className="font-semibold text-green-950">Entry verified</p>
                    <p className="mt-1 text-sm leading-relaxed text-green-800">{nodeLabel} remains assigned to you until checkout or forfeiture.</p>
                  </div>
                </div>

                {cooldownSeconds > 0 ? (
                  <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                        <Timer size={18} weight="bold" />
                        Break cooldown
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-gray-600">The full 15-minute allowance was used. Another break becomes available when this timer ends.</p>
                    </div>
                    <p className="font-mono text-3xl font-bold text-amber-900">{formatTime(cooldownSeconds)}</p>
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <Coffee size={22} weight="duotone" className="mt-0.5 shrink-0 text-[#063a64]" />
                      <div>
                        <p className="font-semibold text-gray-950">Need to step away?</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-600">Begin with five minutes. You can add two five-minute extensions, up to 15 minutes total.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBreakDialog(true)}
                      disabled={Boolean(busyAction)}
                      className="ui-button-primary mt-5 w-full py-3 sm:w-auto"
                    >
                      <Coffee size={18} weight="bold" />
                      Start a five-minute break
                    </button>
                  </div>
                )}

                <div className="border-t border-gray-100 px-5 py-4">
                  <button type="button" onClick={handleCheckout} disabled={Boolean(busyAction)} className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-900 disabled:opacity-50">
                    <SignOut size={18} weight="bold" />
                    Check out and release node
                  </button>
                </div>
              </section>
            )}

            {status === 'on_break' && (
              <section className={`overflow-hidden rounded-[8px] border shadow-[0_22px_64px_rgba(14,35,56,0.16)] ${breakIsUrgent ? 'border-red-300' : 'border-blue-900'}`}>
                <div className={`${breakIsUrgent ? 'bg-red-950' : 'bg-[#082f55]'} p-5 text-white transition-colors`}>
                  <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-100">
                        {breakIsUrgent ? <Warning size={20} weight="fill" className="text-red-200" /> : <Coffee size={20} weight="fill" />}
                        {breakIsUrgent ? 'Return now' : 'Break protected'}
                      </div>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-blue-100">Your belongings may remain at {nodeLabel}. Scan its QR before time expires to keep the reservation.</p>
                    </div>
                    <div
                      className="grid h-28 w-28 shrink-0 place-items-center self-center rounded-full p-2 sm:self-auto"
                      style={{ background: `conic-gradient(${breakIsUrgent ? '#fca5a5' : '#7dd3fc'} ${breakProgress * 3.6}deg, rgba(255,255,255,0.16) 0deg)` }}
                    >
                      <div className={`${breakIsUrgent ? 'bg-red-950' : 'bg-[#082f55]'} grid h-full w-full place-items-center rounded-full transition-colors`}>
                        <span className="font-mono text-2xl font-bold">{formatTime(breakSeconds)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-sm font-semibold text-gray-950">Time allowance</p>
                      <p className="mt-1 text-sm text-gray-500">{allocatedBreakMinutes} of 15 minutes allocated</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => performAction('extend_break', `/api/reservations/${reservation.reservationId}/extend-break`)}
                      disabled={Boolean(busyAction) || allocatedBreakMinutes >= 15}
                      className="inline-flex items-center gap-2 whitespace-nowrap rounded-[8px] border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100 active:translate-y-px disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <Plus size={17} weight="bold" />
                      Add five minutes
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2" aria-label={`${allocatedBreakMinutes} of 15 break minutes allocated`}>
                    {[5, 10, 15].map((minutes) => (
                      <div key={minutes}>
                        <div className={`h-2 rounded-sm ${allocatedBreakMinutes >= minutes ? 'bg-blue-700' : 'bg-gray-200'}`} />
                        <p className="mt-1 text-xs font-medium text-gray-500">{minutes} min</p>
                      </div>
                    ))}
                  </div>
                  {allocatedBreakMinutes >= 15 && (
                    <p className="mt-4 text-sm leading-relaxed text-amber-800">Maximum time reached. Returning on time starts a 30-minute break cooldown.</p>
                  )}
                </div>
              </section>
            )}

            {['expired', 'cancelled', 'completed'].includes(status) && (
              <section className="ui-panel p-5">
                <p className="font-semibold text-gray-900">
                  {status === 'expired' ? 'Reservation expired' : status === 'cancelled' ? 'Reservation cancelled' : 'Session completed'}
                </p>
                <p className="mt-2 text-sm text-gray-500">The reservation node is available for another student.</p>
                <Link to="/" className="ui-button-primary mt-4">Find another node</Link>
              </section>
            )}
          </div>

          <aside className="ui-panel self-start p-5 text-center">
            {status === 'pending_entry' && verificationUrl ? (
              <>
                <p className="text-sm font-semibold text-gray-900">Front-desk QR receipt</p>
                <div className="mx-auto mt-4 w-fit rounded-[8px] border border-gray-200 bg-white p-3 shadow-[0_10px_28px_rgba(14,35,56,0.08)]">
                  <QRCodeSVG value={verificationUrl} size={220} />
                </div>
                <p className="mt-3 text-xs text-gray-500">Reference {reservation.reservationId.slice(-8).toUpperCase()}</p>
              </>
            ) : status === 'on_break' && isDemo ? (
              <>
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-900">
                  <QrCode size={19} weight="bold" />
                  Sample node QR
                </div>
                <div className="mx-auto mt-4 w-fit rounded-[8px] border border-gray-200 bg-white p-3 shadow-[0_10px_28px_rgba(14,35,56,0.08)]">
                  <QRCodeSVG value={sampleSeatQrUrl} size={220} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-500">In the library, this code is attached to {nodeLabel}.</p>
                <Link to={`/seat-return/${encodeURIComponent(seat.seatId || '')}`} className="mt-4 inline-flex items-center gap-2 rounded-[8px] bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 active:translate-y-px">
                  <QrCode size={18} weight="bold" />
                  Open sample scan
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-900">Reservation status</p>
                <StatusMark status={status} />
              </>
            )}
          </aside>
        </div>

        {showBreakDialog && (
          <BreakStartDialog
            nodeLabel={nodeLabel}
            busy={busyAction === 'start_break'}
            onClose={() => setShowBreakDialog(false)}
            onConfirm={async () => {
              const updated = await performAction('start_break', `/api/reservations/${reservation.reservationId}/start-break`);
              if (updated) setShowBreakDialog(false);
            }}
          />
        )}
      </section>
    </Layout>
  );
}

function BreakStartDialog({ nodeLabel, busy, onClose, onConfirm }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 p-0 sm:place-items-center sm:p-5" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="w-full rounded-t-[8px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.3)] sm:max-w-lg sm:rounded-[8px]" role="dialog" aria-modal="true" aria-labelledby="break-dialog-title">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-blue-100 text-blue-900">
              <Coffee size={22} weight="duotone" />
            </div>
            <div>
              <h2 id="break-dialog-title" className="text-lg font-bold text-gray-950">Start a five-minute break?</h2>
              <p className="mt-1 text-sm text-gray-500">Your reservation at {nodeLabel} stays protected.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close break confirmation" className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <X size={19} weight="bold" />
          </button>
        </div>

        <div className="p-5">
          <div className="space-y-4 text-sm text-gray-700">
            <Rule icon={Timer} title="Starts with five minutes" copy="Add five minutes twice if needed. The maximum is 15 minutes." />
            <Rule icon={QrCode} title="Return at your node" copy={`Scan the QR attached to ${nodeLabel}. A remote return is not accepted.`} />
            <Rule icon={Warning} title="Timer expiry releases the node" copy="If time reaches zero before the scan, the reservation is forfeited." />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-[8px] px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50">Stay checked in</button>
            <button type="button" onClick={onConfirm} disabled={busy} className="ui-button-primary">
              <Coffee size={18} weight="bold" />
              {busy ? 'Starting break...' : 'Start break now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Rule({ icon: Icon, title, copy }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={20} weight="duotone" className="mt-0.5 shrink-0 text-blue-800" />
      <div>
        <p className="font-semibold text-gray-950">{title}</p>
        <p className="mt-0.5 leading-relaxed text-gray-600">{copy}</p>
      </div>
    </div>
  );
}

function Detail({ label, value, emphasis = false, mono = false }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className={`mt-1 break-words text-sm ${emphasis ? 'font-bold text-blue-800' : 'font-medium text-gray-900'} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function StatusMark({ status }) {
  const labels = {
    active: ['Verified', 'bg-green-100 text-green-800'],
    on_break: ['On break', 'bg-blue-100 text-blue-800'],
    expired: ['Expired', 'bg-red-100 text-red-800'],
    cancelled: ['Cancelled', 'bg-gray-100 text-gray-700'],
    completed: ['Completed', 'bg-green-100 text-green-800'],
  };
  const [label, classes] = labels[status] || ['Processing', 'bg-amber-100 text-amber-800'];
  return <div className={`mt-5 rounded-md px-4 py-8 text-2xl font-bold ${classes}`}>{label}</div>;
}
