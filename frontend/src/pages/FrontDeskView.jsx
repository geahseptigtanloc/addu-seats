import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { apiClient, getToken } from '../api/client.js';
import { getReceiptCode, normalizePendingReservation } from '../api/normalizers.js';
import { io } from 'socket.io-client';
import { CheckCircle, ClockCountdown, IdentificationCard, X } from '@phosphor-icons/react';
import AppDialog from '../components/AppDialog.jsx';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function getCountdown(deadline) {
  if (!deadline) return '';
  const difference = new Date(deadline).getTime() - Date.now();
  if (difference <= 0) return 'Expired';
  const minutes = Math.floor(difference / 60000);
  const seconds = Math.floor((difference % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getNodeType(seatType) {
  if (seatType === 'table_node') return 'Collaborative table';
  if (seatType === 'cubicle') return 'Study cubicle';
  return 'Individual seat';
}

export default function FrontDeskView() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState(null);
  const [, setTick] = useState(0);

  const fetchQueue = useCallback(async () => {
    setError('');
    try {
      const data = await apiClient('/api/reservations/pending');
      setQueue(data.map(normalizePendingReservation));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const pollInterval = setInterval(fetchQueue, 10000);
    const tickInterval = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, [fetchQueue]);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on('seat_flagged_admin_notice', (data) => {
      setNotice({
        tone: 'warning',
        title: 'Possible ghost seat reported',
        description: `A student reported a vacant seat on Floor ${data.floor} in ${data.building.replace('_', ' ')}.`,
      });
    });
    return () => socket.disconnect();
  }, []);

  function beginReview(reservationId) {
    setReviewingId(reservationId);
    setNameConfirmed(false);
    setReceiptConfirmed(false);
    setRejecting(false);
    setReason('');
  }

  function closeReview() {
    setReviewingId(null);
    setNameConfirmed(false);
    setReceiptConfirmed(false);
    setRejecting(false);
    setReason('');
  }

  async function handleApprove(reservationId) {
    if (!nameConfirmed || !receiptConfirmed) return;
    try {
      await apiClient(`/api/reservations/${reservationId}/approve`, { method: 'POST' });
      closeReview();
      fetchQueue();
    } catch (err) {
      setNotice({ tone: 'danger', title: 'Approval failed', description: err.message });
    }
  }

  async function handleReject(reservationId) {
    if (!reason.trim()) return;
    try {
      await apiClient(`/api/reservations/${reservationId}/void`, { method: 'POST' });
      closeReview();
      fetchQueue();
    } catch (err) {
      setNotice({ tone: 'danger', title: 'Rejection failed', description: err.message });
    }
  }

  return (
    <Layout>
      <section className="ui-surface-band flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-end">
        <div>
          <div className="ui-kicker mb-3"><IdentificationCard size={18} weight="fill" />Entry verification</div>
          <h1 className="ui-page-title">Pending entry queue</h1>
          <p className="ui-muted mt-2">Match the receipt code, then confirm the student's name and university ID before approving entry.</p>
        </div>
        <div className="ui-panel flex min-h-11 items-center gap-3 self-start px-4 py-2 text-sm">
          <ClockCountdown size={20} weight="duotone" className="text-[#063a64]" />
          <span className="font-semibold text-slate-950">{queue.length}</span>
          <span className="text-slate-500">waiting</span>
        </div>
      </section>

      {error && (
        <div className="ui-alert-danger mt-5">{error}</div>
      )}

      <section className="py-6" aria-label="Pending reservations">
        {loading ? (
          <div className="grid gap-3">
            <div className="loading-skeleton h-28 rounded-[8px]" />
            <div className="loading-skeleton h-28 rounded-[8px]" />
            <div className="loading-skeleton h-28 rounded-[8px]" />
          </div>
        ) : queue.length === 0 ? (
          <div className="ui-panel grid min-h-72 place-items-center px-6 py-12 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-[8px] bg-[#e6f0f7] text-[#063a64]"><IdentificationCard size={25} weight="duotone" /></span>
              <h2 className="mt-4 font-semibold text-slate-950">No students waiting</h2>
              <p className="mt-1 text-sm text-slate-500">New five-minute reservations will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((reservation) => {
              const isReviewing = reviewingId === reservation.reservationId;
              const timeLeft = new Date(reservation.entryDeadline).getTime() - Date.now();
              const isUrgent = timeLeft > 0 && timeLeft < 60000;
              const isExpired = timeLeft <= 0;
              const seatLabel = reservation.seat.label || 'Unlabeled node';
              const receiptCode = getReceiptCode(reservation.reservationId);
              const studentId = reservation.user.adduIdLast4
                ? `ID ending in ${reservation.user.adduIdLast4}`
                : 'Check physical university ID';

              return (
                <article key={reservation.reservationId} className={`ui-panel overflow-hidden ${isUrgent ? 'border-red-300 shadow-[0_18px_48px_rgba(185,28,28,0.12)]' : ''}`}>
                  <div className="grid gap-4 p-5 sm:grid-cols-[1.2fr_1fr_0.8fr_auto] sm:items-center">
                    <div>
                      <p className="font-semibold text-slate-950">{reservation.user.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{studentId}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[#063a64]">{seatLabel}</p>
                      <p className="mt-1 text-sm text-slate-500">{getNodeType(reservation.seat.seatType)} - Floor {reservation.seat.floor}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receipt code</p>
                      <p className="mt-1 font-mono text-lg font-bold tracking-wider text-[#063a64]">{receiptCode}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className={`font-mono text-lg font-bold ${isExpired ? 'text-gray-400' : isUrgent ? 'text-red-600' : 'text-blue-700'}`}>
                        {getCountdown(reservation.entryDeadline)}
                      </span>
                      <button
                        type="button"
                        onClick={() => (isReviewing ? closeReview() : beginReview(reservation.reservationId))}
                        disabled={isExpired}
                        className={isReviewing ? 'ui-button-secondary' : 'ui-button-primary'}
                      >
                        {isReviewing ? <><X size={17} weight="bold" />Close</> : <><IdentificationCard size={17} weight="bold" />Review</>}
                      </button>
                    </div>
                  </div>

                  {isReviewing && (
                    <div className="border-t border-slate-200 bg-[#f5f9fc] px-5 py-5">
                      <div className="grid gap-3 rounded-[8px] border border-blue-200 bg-white p-4 sm:grid-cols-3">
                        <div><p className="ui-label">Receipt code</p><p className="mt-1 font-mono text-lg font-bold tracking-wider text-[#063a64]">{receiptCode}</p></div>
                        <div><p className="ui-label">Student name</p><p className="mt-1 text-sm font-semibold text-slate-950">{reservation.user.name}</p></div>
                        <div><p className="ui-label">Student ID</p><p className="mt-1 text-sm font-semibold text-slate-950">{studentId}</p></div>
                      </div>
                      <h3 className="mt-5 text-sm font-semibold text-slate-950">Required verification</h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 shadow-[0_8px_18px_rgba(14,35,56,0.05)]">
                          <CheckCircle size={20} weight="duotone" className="mt-0.5 shrink-0 text-[#063a64]" />
                          <input type="checkbox" checked={receiptConfirmed} onChange={(event) => setReceiptConfirmed(event.target.checked)} className="mt-1 h-4 w-4" />
                          <span>Receipt code <strong>{receiptCode}</strong> matches the student's receipt.</span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 shadow-[0_8px_18px_rgba(14,35,56,0.05)]">
                          <IdentificationCard size={20} weight="duotone" className="mt-0.5 shrink-0 text-[#063a64]" />
                          <input type="checkbox" checked={nameConfirmed} onChange={(event) => setNameConfirmed(event.target.checked)} className="mt-1 h-4 w-4" />
                          <span>Student name and university ID match the person presenting the receipt.</span>
                        </label>
                      </div>

                      {rejecting ? (
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                          <input
                            type="text"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Reason for rejection"
                            className="min-h-10 min-w-0 flex-1 rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                          <button type="button" onClick={() => setRejecting(false)} className="ui-button-secondary">Cancel</button>
                          <button type="button" onClick={() => handleReject(reservation.reservationId)} disabled={!reason.trim()} className="ui-button-danger bg-red-700 text-white hover:bg-red-800">Reject reservation</button>
                        </div>
                      ) : (
                        <div className="mt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setRejecting(true)} className="ui-button-danger">Reject</button>
                          <button
                            type="button"
                            onClick={() => handleApprove(reservation.reservationId)}
                            disabled={!nameConfirmed || !receiptConfirmed}
                            className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(4,120,87,0.18)] hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0"
                          >
                            <CheckCircle size={18} weight="bold" />
                            Approve entry
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
      <AppDialog
        open={Boolean(notice)}
        tone={notice?.tone}
        title={notice?.title}
        description={notice?.description}
        confirmLabel="Close"
        onClose={() => setNotice(null)}
      />
    </Layout>
  );
}
