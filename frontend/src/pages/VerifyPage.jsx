import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, IdentificationCard, QrCode, WarningCircle } from '@phosphor-icons/react';
import Layout from '../components/Layout.jsx';
import { apiClient } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getDemoReservation, updateDemoReservation } from '../data/demoReservationStore.js';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { canUseProtectedApi } = useAuth();
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No verification token provided');
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        if (!canUseProtectedApi) {
          const demoReservation = getDemoReservation({ includeTerminal: true });
          if (!demoReservation || demoReservation.qrToken !== token) throw new Error('Matching sample reservation not found');
          setReservation({ ...demoReservation, alreadyVerified: demoReservation.status === 'active' });
          return;
        }
        setReservation(await apiClient(`/api/frontdesk/lookup/${encodeURIComponent(token)}`));
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };
    verifyToken();
  }, [token, canUseProtectedApi]);

  const handleApprove = async () => {
    try {
      if (canUseProtectedApi) {
        await apiClient(`/api/frontdesk/verify/${reservation.reservationId}`, { method: 'POST', body: JSON.stringify({ approved: true }) });
      } else {
        updateDemoReservation(reservation.reservationId, 'approve');
      }
      navigate('/frontdesk');
    } catch (requestError) {
      alert(`Approval failed: ${requestError.message}`);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    try {
      if (canUseProtectedApi) {
        await apiClient(`/api/frontdesk/verify/${reservation.reservationId}`, { method: 'POST', body: JSON.stringify({ approved: false, rejectionReason: reason }) });
      } else {
        updateDemoReservation(reservation.reservationId, 'reject', { reason });
      }
      navigate('/frontdesk');
    } catch (requestError) {
      alert(`Rejection failed: ${requestError.message}`);
    }
  };

  return (
    <Layout>
      <section className="mx-auto max-w-3xl">
        <button type="button" onClick={() => navigate('/frontdesk')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#073b66] hover:underline">
          <ArrowLeft size={17} weight="bold" />
          Pending queue
        </button>

        <div className="ui-panel overflow-hidden">
          <div className="border-b border-slate-200 bg-[#f7f9fb] px-5 py-5 sm:px-6">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-blue-100 text-[#073b66]"><IdentificationCard size={24} weight="duotone" /></span>
              <div><p className="text-sm font-semibold text-amber-700">Front-desk verification</p><h1 className="mt-1 text-xl font-semibold text-slate-950">Review reservation</h1></div>
            </div>
          </div>

          {loading ? (
            <div className="grid min-h-72 place-items-center p-6 text-sm font-medium text-slate-500">Loading reservation data...</div>
          ) : error ? (
            <div className="m-5 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"><WarningCircle size={21} weight="fill" className="shrink-0" /><span>{error}</span></div>
          ) : (
            <div className="p-5 sm:p-6">
              {reservation.alreadyVerified && (
                <div className="mb-6 flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle size={21} weight="fill" className="shrink-0" /><span>This reservation has already been approved and is active.</span></div>
              )}

              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
                <Detail label="Student" value={reservation.user.name} />
                <Detail label="AdDU ID" value={`Ending in ${reservation.user.adduIdLast4 || 'N/A'}`} mono />
                <Detail label="Reservation node" value={reservation.seat.label || 'Reservation node'} accent />
                <Detail label="Location" value={`${reservation.seat.building.replace('_', ' ')} · Floor ${reservation.seat.floor}`} />
                <Detail label="Status" value={reservation.alreadyVerified ? 'Active' : 'Pending entry'} />
                <Detail label="Reference" value={reservation.reservationId.slice(-8).toUpperCase()} mono />
              </div>

              {!reservation.alreadyVerified && (
                <>
                  <div className="mt-7 border-t border-slate-200 pt-5">
                    <h2 className="text-sm font-semibold text-slate-950">Required checks</h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <CheckItem icon={QrCode} checked={receiptConfirmed} onChange={setReceiptConfirmed}>QR receipt matches this reservation.</CheckItem>
                      <CheckItem icon={IdentificationCard} checked={identityConfirmed} onChange={setIdentityConfirmed}>Name and ID ending in {reservation.user.adduIdLast4 || 'N/A'} match.</CheckItem>
                    </div>
                  </div>

                  {rejecting ? (
                    <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4">
                      <label htmlFor="rejection-reason" className="text-sm font-semibold text-red-950">Rejection reason</label>
                      <input id="rejection-reason" type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter a clear reason" className="mt-2 min-h-11 w-full rounded-md border border-red-200 bg-white px-3 text-sm" />
                      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setRejecting(false)} className="ui-button-secondary">Cancel</button><button type="button" onClick={handleReject} disabled={!reason.trim()} className="ui-button-danger bg-red-700 text-white hover:bg-red-800">Confirm rejection</button></div>
                    </div>
                  ) : (
                    <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setRejecting(true)} className="ui-button-danger">Reject</button>
                      <button type="button" onClick={handleApprove} disabled={!receiptConfirmed || !identityConfirmed} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"><CheckCircle size={18} weight="bold" />Approve entry</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

function Detail({ label, value, mono, accent }) {
  return <div className="min-w-0"><p className="ui-label">{label}</p><p className={`mt-1 break-words text-sm font-semibold ${accent ? 'text-[#073b66]' : 'capitalize text-slate-900'} ${mono ? 'font-mono' : ''}`}>{value}</p></div>;
}

function CheckItem({ icon: Icon, checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-[#f7f9fb] p-4 text-sm leading-6 text-slate-700">
      <Icon size={20} weight="duotone" className="mt-0.5 shrink-0 text-[#073b66]" />
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4" />
      <span>{children}</span>
    </label>
  );
}
