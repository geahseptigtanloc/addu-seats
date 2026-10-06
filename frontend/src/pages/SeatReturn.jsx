import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle, QrCode, WarningCircle } from '@phosphor-icons/react';
import Layout from '../components/Layout.jsx';
import { apiClient, getGoogleAuthUrl } from '../api/client.js';
import { normalizeReservation } from '../api/normalizers.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { storePendingReverifyToken } from '../utils/pendingReservation.js';

export default function SeatReturn() {
  const { seatId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qrToken = searchParams.get('token');
  const { user, loading: authLoading } = useAuth();
  const { clearReservationNotification } = useNotifications();
  const handledScan = useRef(false);
  const [result, setResult] = useState({ state: 'checking', message: 'Checking reservation...' });

  useEffect(() => {
    if (handledScan.current) return;

    if (!qrToken) {
      handledScan.current = true;
      setResult({
        state: 'unavailable',
        message: 'This link does not contain the physical seat QR token.',
      });
      return;
    }

    if (authLoading || !user) return;
    handledScan.current = true;

    void (async () => {
      try {
        const current = normalizeReservation(await apiClient('/api/reservations/me/current'));
        if (!current || (seatId && current.seat?.seatId !== seatId)) {
          throw new Error('This QR belongs to a different reserved seat.');
        }

        const verification = await apiClient('/api/reservations/reverify', {
          method: 'POST',
          body: JSON.stringify({ qrToken }),
        });
        if (!['flag_cleared', 'break_ended'].includes(verification?.outcome)) {
          throw new Error('The verification response was not recognized.');
        }

        let refreshedReservation = current;
        try {
          refreshedReservation = normalizeReservation(
            await apiClient('/api/reservations/me/current'),
            { user },
          );
        } catch {
          // The verification already succeeded. The receipt page will retry its own refresh.
        }

        setResult({
          state: 'success',
          outcome: verification.outcome,
          message: verification.outcome === 'break_ended'
            ? 'Your break has ended and your study session is active again.'
            : 'Your presence is confirmed and the ghost-seat report has been cleared.',
          seatLabel: current.seat?.label,
        });
        clearReservationNotification(current.reservationId);
        window.setTimeout(() => {
          navigate('/receipt', {
            replace: true,
            state: { reservation: refreshedReservation },
          });
        }, 1600);
      } catch (error) {
        setResult({ state: 'error', message: verificationErrorMessage(error) });
      }
    })();
  }, [authLoading, clearReservationNotification, navigate, seatId, qrToken, user]);

  function handleSignIn() {
    storePendingReverifyToken(qrToken);
    window.location.href = getGoogleAuthUrl();
  }

  const requiresSignIn = !user && !authLoading && Boolean(qrToken);

  return (
    <Layout>
      <section className="mx-auto max-w-xl py-10 sm:py-16">
        <div className={`overflow-hidden rounded-[8px] border bg-white shadow-[0_22px_64px_rgba(14,35,56,0.14)] ${result.state === 'success' ? 'border-green-200' : 'border-gray-200'}`}>
          <div className={`${result.state === 'success' ? 'bg-green-50' : 'bg-gray-50'} grid place-items-center border-b p-8`}>
            <div className={`grid h-16 w-16 place-items-center rounded-full ${result.state === 'success' ? 'bg-green-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
              {result.state === 'success'
                ? <CheckCircle size={36} weight="fill" />
                : result.state === 'checking'
                  ? <QrCode size={34} weight="duotone" />
                  : <WarningCircle size={34} weight="fill" />}
            </div>
          </div>

          <div className="p-6 text-center sm:p-8">
            <p className="ui-kicker justify-center">Seat verify QR</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-950">
              {result.state === 'success'
                ? result.outcome === 'break_ended' ? 'Welcome back' : "You're verified"
                : requiresSignIn ? 'Sign in to confirm your presence' : result.state === 'checking' ? 'Checking your verification' : 'Verification not completed'}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-600">
              {requiresSignIn ? 'Use the reservation holder account. This QR token will be kept through sign-in.' : result.message}
            </p>

            {requiresSignIn && (
              <button type="button" onClick={handleSignIn} className="ui-button-primary mt-7">
                Continue to sign in
                <ArrowRight size={17} weight="bold" />
              </button>
            )}

            {result.seatLabel && (
              <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-4 border-y border-gray-100 py-4 text-left">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Reserved seat</p>
                  <p className="mt-1 font-semibold text-[#063a64]">{result.seatLabel}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Session</p>
                  <p className="mt-1 font-semibold text-green-800">Active</p>
                </div>
              </div>
            )}

            {result.cooldownUntil && (
              <p className="mx-auto mt-4 max-w-sm rounded-[8px] bg-amber-50 px-4 py-3 text-sm text-amber-900">
                The full break allowance was used. Your 30-minute cooldown is now active.
              </p>
            )}

            {user && (
              <Link to="/receipt" className="ui-button-primary mt-7">
                {result.state === 'success' ? 'Opening reservation...' : 'Return to reservation'}
                <ArrowRight size={17} weight="bold" />
              </Link>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

function verificationErrorMessage(error) {
  if (error?.status === 404) {
    return 'No matching reservation found for this seat.';
  }
  if (error?.status === 409 && error.message?.includes('verification window has expired')) {
    return 'The verification window has expired. Please speak with the front desk.';
  }
  if (error?.status === 409) {
    return 'Nothing to verify right now.';
  }
  if (error?.status === 400) {
    return 'This verification QR is missing its seat token. Please scan it again.';
  }
  return error?.message || 'Verification could not be completed. Please try again.';
}
