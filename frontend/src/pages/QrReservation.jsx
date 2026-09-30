import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, MapPin, QrCode, WarningCircle } from '@phosphor-icons/react';
import Layout from '../components/Layout.jsx';
import { apiClient } from '../api/client.js';
import { normalizeReservation, normalizeSeat, seatLabelFromQrToken } from '../api/normalizers.js';
import { useAuth } from '../context/AuthContext.jsx';

function titleCase(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function QrReservation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const qrToken = searchParams.get('token') || '';
  const [seat, setSeat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user || !qrToken || user.role !== 'student') return;

    let cancelled = false;
    setLoading(true);
    setError('');
    apiClient('/api/seats/scan', {
      method: 'POST',
      body: JSON.stringify({ qrToken }),
    })
      .then((data) => {
        if (!cancelled) setSeat(normalizeSeat(data.seat));
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, qrToken, user]);

  const handleSignIn = () => {
    const returnTo = `/reserve?token=${encodeURIComponent(qrToken)}`;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleReserve = async () => {
    if (!seat || seat.status !== 'available') return;
    setReserving(true);
    setError('');
    try {
      const response = await apiClient('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({ qrToken }),
      });
      const reservation = normalizeReservation(response, { seat, user });
      navigate('/receipt', {
        replace: true,
        state: {
          reservation,
          qrToken: response.qrToken || reservation.reservationId,
        },
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReserving(false);
    }
  };

  const scannedLabel = seat?.label || seatLabelFromQrToken(qrToken) || 'Scanned node';
  const locationLabel = seat
    ? `${titleCase(seat.building)}${seat.building === 'gisbert' ? ' Library' : ''} - Floor ${seat.floor}`
    : '';
  const mapPath = seat ? `/map/${seat.building}/${seat.floor}` : '/';

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
              <Message icon={WarningCircle} title="QR code missing" copy="Open this page by scanning the QR attached to a mapped study node." tone="danger" />
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
            ) : loading ? (
              <div className="space-y-3">
                <div className="loading-skeleton h-24 rounded-[8px]" />
                <div className="loading-skeleton h-12 rounded-[8px]" />
              </div>
            ) : error && !seat ? (
              <Message icon={WarningCircle} title="QR could not be verified" copy={error} tone="danger" />
            ) : seat ? (
              <>
                <div className="grid gap-4 rounded-[8px] border border-emerald-200 bg-emerald-50 p-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-emerald-700">Reservation node</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-950">{scannedLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-emerald-700">Location</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-950"><MapPin size={17} weight="fill" />{locationLabel}</p>
                  </div>
                </div>

                <div className="mt-5 flex gap-3 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <Clock size={21} weight="duotone" className="mt-0.5 shrink-0" />
                  <span>After you reserve, present the digital receipt and your name at the front desk within five minutes.</span>
                </div>

                {error && <div className="ui-alert-danger mt-5">{error}</div>}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Link to={mapPath} className="ui-button-secondary">Cancel</Link>
                  <button type="button" onClick={handleReserve} disabled={reserving || seat.status !== 'available'} className="ui-button-primary">
                    <CheckCircle size={18} weight="bold" />
                    {reserving ? 'Creating reservation...' : seat.status === 'available' ? `Reserve ${scannedLabel}` : `Currently ${seat.status.replace('_', ' ')}`}
                  </button>
                </div>
              </>
            ) : null}
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
