import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle, QrCode, WarningCircle } from '@phosphor-icons/react';
import Layout from '../components/Layout.jsx';
import { apiClient } from '../api/client.js';
import { normalizeReservation } from '../api/normalizers.js';

export default function SeatReturn() {
  const { seatId } = useParams();
  const [searchParams] = useSearchParams();
  const qrToken = searchParams.get('token');
  const handledScan = useRef(false);
  const [result, setResult] = useState({ state: 'checking', message: 'Checking reservation...' });

  useEffect(() => {
    if (handledScan.current) return;
    handledScan.current = true;

    if (!qrToken) {
      setResult({
        state: 'unavailable',
        message: 'This link does not contain the physical seat QR token.',
      });
      return;
    }

    void (async () => {
      try {
        const current = normalizeReservation(await apiClient('/api/reservations/me/current'));
        if (!current || current.seat?.seatId !== seatId) {
          throw new Error('This QR belongs to a different reserved seat.');
        }

        if (current.status === 'on_break') {
          await apiClient('/api/reservations/break/return', {
            method: 'POST',
            body: JSON.stringify({ qrToken }),
          });
        } else {
          await apiClient('/api/reservations/reverify', {
            method: 'POST',
            body: JSON.stringify({ qrToken }),
          });
        }

        setResult({
          state: 'success',
          message: current.status === 'on_break'
            ? 'Return confirmed. Your study session is active again.'
            : 'Presence confirmed. The ghost-seat report has been cleared.',
          seatLabel: current.seat?.label,
        });
      } catch (error) {
        setResult({ state: 'error', message: error.message });
      }
    })();
  }, [seatId, qrToken]);

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
            <p className="ui-kicker justify-center">Physical seat QR</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-950">
              {result.state === 'success' ? 'You are checked back in' : result.state === 'checking' ? 'Checking your return' : 'Return not confirmed'}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-600">{result.message}</p>

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
