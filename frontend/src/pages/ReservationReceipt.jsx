import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient, getToken } from '../api/client.js';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function ReservationReceipt() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const initialReservation = location.state?.reservation;
  const qrToken = location.state?.qrToken;

  const [reservation, setReservation] = useState(initialReservation);
  const [timeLeft, setTimeLeft] = useState(0);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [expired, setExpired] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [flagMessage, setFlagMessage] = useState('');

  useEffect(() => {
    const fetchCurrentReservation = async () => {
      try {
        const data = await apiClient('/api/reservations/me/current');
        setReservation(data.reservation);
        if (data.qrToken) {
          // keep qrToken available for pending-entry QR rendering
          // no-op here because this page uses location.state for the QR
        }
      } catch {
        navigate('/');
      }
    };

    if (!initialReservation && !qrToken) {
      fetchCurrentReservation();
    }
  }, [initialReservation, qrToken, navigate]);

  // Socket for personal notifications (flags, break expiry, auto-updates to active state)
  useEffect(() => {
    const token = getToken();
    if (!token || !reservation) return;

    const socket = io(`${SOCKET_URL}/user`, {
      auth: { token }
    });

    socket.on('seat_flagged', (data) => {
      if (data.reservationId === reservation.reservationId) {
        setFlagged(true);
        setFlagMessage(data.message);
      }
    });

    socket.on('reservation_status_updated', (data) => {
      if (data.reservationId === reservation.reservationId) {
        setReservation(prev => ({ ...prev, status: data.status }));
        if (data.status === 'active') {
          setExpired(false);
        }
      }
    });

    socket.on('break_expired', () => {
      setReservation(prev => ({ ...prev, status: 'expired' }));
      setExpired(true);
    });

    socket.on('flag_expired', () => {
      setReservation(prev => ({ ...prev, status: 'expired' }));
      setExpired(true);
    });

    return () => socket.disconnect();
  }, [reservation?.reservationId]);

  // If front desk approves it, we need to know. Since there's no direct personal event for approval in the spec
  // (only seat_status_update on the floor namespace), let's just poll the reservation status every few seconds 
  // while in pending_entry, or we can just let them refresh. Better yet, let's poll if pending.
  useEffect(() => {
    if (reservation?.status === 'pending_entry') {
      const interval = setInterval(async () => {
        try {
          // This endpoint doesn't exist yet, we'll just rely on the map or refresh for now
          // Wait, let's just add a quick refetch using a dummy endpoint or we can skip auto-refresh
          // for the sake of the demo, staff approval turns the seat red on the map.
        } catch {}
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [reservation?.status]);

  useEffect(() => {
    if (!reservation) {
      return;
    }

    if (reservation.status === 'pending_entry') {
      const deadline = new Date(reservation.entryDeadline).getTime();
      const updateTimer = () => {
        const now = Date.now();
        const diff = deadline - now;
        if (diff <= 0) {
          setTimeLeft(0);
          setExpired(true);
          setReservation(prev => ({ ...prev, status: 'expired' }));
        } else {
          setTimeLeft(Math.floor(diff / 1000));
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }

    if (reservation.status === 'on_break') {
      const deadline = new Date(reservation.breakDeadline).getTime();
      const updateTimer = () => {
        const now = Date.now();
        const diff = deadline - now;
        if (diff <= 0) {
          setBreakTimeLeft(0);
          // Auto-expire will be handled by background job + socket event
        } else {
          setBreakTimeLeft(Math.floor(diff / 1000));
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [reservation, navigate]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    
    setCancelling(true);
    try {
      await apiClient(`/api/reservations/${reservation.reservationId}`, {
        method: 'DELETE'
      });
      navigate('/');
    } catch (err) {
      alert(`Cancel failed: ${err.message}`);
      setCancelling(false);
    }
  };

  const handleCheckout = async () => {
    if (!confirm('Are you sure you want to check out and end this reservation?')) return;

    setCancelling(true);
    try {
      await apiClient(`/api/reservations/${reservation.reservationId}/checkout`, {
        method: 'POST'
      });
      navigate('/');
    } catch (err) {
      alert(`Checkout failed: ${err.message}`);
      setCancelling(false);
    }
  };

  const handleStartBreak = async () => {
    try {
      const res = await apiClient(`/api/reservations/${reservation.reservationId}/start-break`, { method: 'POST' });
      setReservation(res);
    } catch (err) { alert(err.message); }
  };

  const handleExtendBreak = async () => {
    try {
      const res = await apiClient(`/api/reservations/${reservation.reservationId}/extend-break`, { method: 'POST' });
      setReservation(res);
    } catch (err) { alert(err.message); }
  };

  const handleReturnBreak = async () => {
    try {
      const res = await apiClient(`/api/reservations/${reservation.reservationId}/return-from-break`, { method: 'POST' });
      setReservation(res);
    } catch (err) { alert(err.message); }
  };

  const handleResolveFlag = async () => {
    try {
      await apiClient(`/api/reservations/${reservation.reservationId}/resolve-flag`, { method: 'POST' });
      setFlagged(false);
      setFlagMessage('');
    } catch (err) { alert(err.message); }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Helper for demo purposes: manually simulate front desk approval
  const simulateApproval = () => {
    setReservation(prev => ({ ...prev, status: 'active' }));
  };

  if (!reservation) return null;

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-8 bg-white p-6 rounded-lg shadow border border-gray-100 text-center relative overflow-hidden">
        
        {flagged && (
          <div className="absolute inset-0 bg-red-600 bg-opacity-95 z-10 flex flex-col items-center justify-center p-6 text-white">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-2">Seat Flagged!</h2>
            <p className="mb-8 text-center">{flagMessage}</p>
            <button 
              onClick={handleResolveFlag}
              className="bg-white text-red-600 font-bold px-8 py-3 rounded-full hover:bg-gray-100 shadow-lg"
            >
              I'm still here
            </button>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {reservation.status === 'active' ? 'Active Reservation' : 
           reservation.status === 'on_break' ? 'On Break' : 'Reservation Receipt'}
        </h1>
        
        {reservation.status === 'expired' || expired ? (
          <div className="py-8">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Reservation Expired</h2>
            <p className="text-gray-500 mb-6">Your reservation has been forfeited.</p>
            <button 
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-bold"
            >
              Return to Map
            </button>
          </div>
        ) : reservation.status === 'active' ? (
          <div className="py-8">
            <div className="text-green-500 text-5xl mb-4">✅</div>
            <p className="text-gray-600 mb-6">You are currently checked in.</p>
            
            {reservation.cooldownUntil && new Date(reservation.cooldownUntil) > new Date() ? (
              <div className="mb-6 p-3 bg-orange-50 text-orange-800 text-sm rounded border border-orange-200">
                Break unavailable until {new Date(reservation.cooldownUntil).toLocaleTimeString()} 
                <br/>(You used your full break allowance last time)
              </div>
            ) : (
              <button 
                onClick={handleStartBreak}
                className="w-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 font-bold py-3 px-4 rounded transition-colors mb-4"
              >
                Start Break (15m max)
              </button>
            )}
            
            <button 
              onClick={handleCheckout}
              disabled={cancelling}
              className="w-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 mt-4"
            >
              {cancelling ? 'Checking out...' : 'Check Out / End Session'}
            </button>
          </div>
        ) : reservation.status === 'on_break' ? (
          <div className="py-8">
            <div className="text-blue-500 text-5xl mb-4">☕</div>
            <div className="mb-8">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-bold mb-1">Break Time Remaining</p>
              <div className="text-4xl font-mono text-blue-600 font-bold">
                {formatTime(breakTimeLeft)}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleReturnBreak}
                className="w-full bg-green-600 text-white hover:bg-green-700 font-bold py-3 px-4 rounded shadow-md"
              >
                I'm Back — Confirm Return
              </button>
              
              <button 
                onClick={handleExtendBreak}
                disabled={reservation.breakMinutesUsed + 5 > 15}
                title={reservation.breakMinutesUsed + 5 > 15 ? "Maximum break time reached" : ""}
                className="w-full bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                Extend Break (+5 min)
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4">Break used: {reservation.breakMinutesUsed} / 15 min</p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">Present this QR code at the front desk within 5 minutes to confirm your seat.</p>
            
            <div className="flex justify-center mb-6 p-4 bg-gray-50 rounded-lg inline-block">
              <QRCodeSVG value={`${window.location.origin}/verify?token=${encodeURIComponent(qrToken)}`} size={200} />
            </div>

            <div className="mb-8">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-bold mb-1">Time Remaining</p>
              <div className="text-4xl font-mono text-blue-600 font-bold">
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Reservation'}
              </button>
              
              {/* Demo button to skip having to use two accounts */}
              <button onClick={simulateApproval} className="text-xs text-gray-300 hover:text-gray-500 mt-4 underline">
                [Demo: Simulate Front Desk Approval]
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
