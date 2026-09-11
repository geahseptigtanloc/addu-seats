import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle, QrCode, WarningCircle } from '@phosphor-icons/react';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getDemoReservation, updateDemoReservation } from '../data/demoReservationStore.js';

export default function SeatReturn() {
  const { seatId } = useParams();
  const { canUseProtectedApi } = useAuth();
  const handledScan = useRef(false);
  const [result, setResult] = useState({ state: 'checking', message: 'Checking reservation...' });

  useEffect(() => {
    if (handledScan.current) return;
    handledScan.current = true;

    if (canUseProtectedApi) {
      setResult({
        state: 'unavailable',
        message: 'This sample QR cannot complete a live-library return.',
      });
      return;
    }

    try {
      const reservation = getDemoReservation();
      if (!reservation || reservation.status !== 'on_break') {
        throw new Error('There is no break in progress for this sample account.');
      }
      if (reservation.seat?.seatId !== seatId) {
        throw new Error('This QR belongs to a different reservation node.');
      }
      const updated = updateDemoReservation(reservation.reservationId, 'qr_return');
      setResult({
        state: 'success',
        message: 'Return confirmed. Your study session is active again.',
        nodeLabel: updated.seat?.label,
        cooldownUntil: updated.cooldownUntil,
      });
    } catch (error) {
      setResult({ state: 'error', message: error.message });
    }
  }, [seatId, canUseProtectedApi]);

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
            <p className="ui-kicker justify-center">Physical node QR</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-950">
              {result.state === 'success' ? 'You are checked back in' : result.state === 'checking' ? 'Checking your return' : 'Return not confirmed'}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-600">{result.message}</p>

            {result.nodeLabel && (
              <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-4 border-y border-gray-100 py-4 text-left">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Reservation node</p>
                  <p className="mt-1 font-semibold text-[#063a64]">{result.nodeLabel}</p>
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

            <Link to="/receipt" className="ui-button-primary mt-7">
              Return to reservation
              <ArrowRight size={17} weight="bold" />
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
