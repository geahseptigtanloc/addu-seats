import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, MapPin, QrCode, WarningCircle } from '@phosphor-icons/react';
import Layout from '../components/Layout.jsx';
import { apiClient, getGoogleAuthUrl } from '../api/client.js';
import { normalizeReservation, normalizeSeat, seatLabelFromQrToken } from '../api/normalizers.js';
import { useAuth } from '../context/AuthContext.jsx';
import { storePendingReservationToken } from '../utils/pendingReservation.js';

function titleCase(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function QrReservation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const qrToken = searchParams.get('token') || '';
  const [reserving, setReserving] = useState(false);
  const [failure, setFailure] = useState(null);

  const tokenSeatLabel = seatLabelFromQrToken(qrToken);
  const scannedSeat = tokenSeatLabel
    ? normalizeSeat(null, { label: tokenSeatLabel, status: 'available' })
    : null;

  const handleSignIn = () => {
    storePendingReservationToken(qrToken);
    window.location.href = getGoogleAuthUrl();
  };

  const handleReserve = async () => {
    setReserving(true);
    setFailure(null);
    try {
      const response = await apiClient('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({ qrToken }),
      });
      const source = response?.reservation || response || {};
      const receiptSeat = normalizeSeat(source.seat, {
        ...scannedSeat,
        seatId: source.seatId || scannedSeat?.seatId,
        label: source.seat?.label || scannedSeat?.label || source.seatId,
        building: source.building || scannedSeat?.building,
        floor: source.floor || scannedSeat?.floor,
        status: 'available',
      });
      const reservation = normalizeReservation(response, { seat: receiptSeat, user });
      navigate('/receipt', {
        replace: true,
        state: {
          reservation,
          qrToken: response.qrToken || reservation.reservationId,
        },
      });
    } catch (requestError) {
      if (requestError.status === 401) {
        handleSignIn();
        return;
      }

      const messages = {
        400: {
          title: 'This QR code is malformed',
          copy: 'Please scan the QR attached to the study node again. If it still fails, notify the front desk.',
        },
        404: {
          title: 'This QR code is no longer active',
          copy: 'The scanned code is invalid or stale. Please notify the front desk.',
        },
        500: {
          title: 'Reservation service unavailable',
          copy: 'Something went wrong while creating your reservation. Please try again.',
          retryable: true,
        },
      };
      setFailure(requestError.status === 409
        ? { title: 'Reservation could not be created', copy: requestError.message }
        : messages[requestError.status] || {
          title: 'Reservation could not be created',
          copy: requestError.message || 'Please try again.',
          retryable: true,
        });
    } finally {
      setReserving(false);
    }
  };

  const scannedLabel = scannedSeat?.label || 'Physical QR';
  const locationLabel = scannedSeat?.building && scannedSeat?.floor
    ? `${titleCase(scannedSeat.building)}${scannedSeat.building === 'gisbert' ? ' Library' : ''} - Floor ${scannedSeat.floor}`
    : '';
  const mapPath = scannedSeat?.building && scannedSeat?.floor
    ? `/map/${scannedSeat.building}/${scannedSeat.floor}`
    : '/';

  return (
    <Layout>
      <section className="mx-auto max-w-2xl py-6 sm:py-10">
        <Link to={mapPath} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#063a64] hover:underline">
          <ArrowLeft size={17} weight="bold" />
          Back to seat map
        </Link>

        <div className="ui-panel overflow-hidden">
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#032946_0%,#0b4d7a_100%)] p-6 text-white sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-white/12 text-amber-200">
                <QrCode size={28} weight="duotone" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-100/70">Physical QR scan</p>
                <h1 className="mt-2 text-2xl font-semibold">Reserve this study node</h1>
                <p className="mt-2 text-sm leading-6 text-blue-100/80">A reservation can begin only from the QR attached to the physical seat or table.</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {!qrToken ? (
              <Message icon={WarningCircle} title="This QR code is malformed" copy="Scan the QR attached to the study node again. If this page still appears, notify the front desk." tone="danger" />
            ) : authLoading ? (
              <div className="space-y-3">
                <div className="loading-skeleton h-20 rounded-[8px]" />
                <div className="loading-skeleton h-12 rounded-[8px]" />
              </div>
            ) : !user ? (
              <>
                <Message icon={QrCode} title={`${scannedLabel} scanned`} copy="Sign in with Google to continue this physical QR reservation." />
                <button type="button" onClick={handleSignIn} className="ui-button-primary mt-6 w-full">Continue to sign in</button>
              </>
            ) : user.role !== 'student' ? (
              <Message icon={WarningCircle} title="Student account required" copy="Administrator accounts can inspect maps but cannot create student reservations." tone="danger" />
            ) : (
              <>
                <div className="grid gap-4 rounded-[8px] border border-emerald-200 bg-emerald-50 p-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-emerald-700">Reservation node</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-950">{scannedLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-emerald-700">Location</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-950"><MapPin size={17} weight="fill" />{locationLabel || 'Confirmed after reservation'}</p>
                  </div>
                </div>

                <div className="mt-5 flex gap-3 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <Clock size={21} weight="duotone" className="mt-0.5 shrink-0" />
                  <span>After you reserve, present the digital receipt and your name at the front desk within five minutes.</span>
                </div>

                {failure && (
                  <div className="mt-5">
                    <Message icon={WarningCircle} title={failure.title} copy={failure.copy} tone="danger" />
                  </div>
                )}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Link to={mapPath} className="ui-button-secondary">Cancel</Link>
                  {(!failure || failure.retryable) && (
                    <button type="button" onClick={handleReserve} disabled={reserving} className="ui-button-primary">
                      <CheckCircle size={18} weight="bold" />
                      {reserving ? 'Creating reservation...' : failure?.retryable ? 'Try reservation again' : `Reserve ${scannedLabel}`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

function Message({ icon: Icon, title, copy, tone = 'info' }) {
  const classes = tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-950'
    : 'border-blue-200 bg-blue-50 text-blue-950';
  return (
    <div className={`flex items-start gap-3 rounded-[8px] border p-5 ${classes}`}>
      <Icon size={23} weight="duotone" className="mt-0.5 shrink-0" />
      <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-6 opacity-80">{copy}</p></div>
    </div>
  );
}
