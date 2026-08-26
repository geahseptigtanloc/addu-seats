import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { apiClient, API_URL } from '../api/client.js';
import { io } from 'socket.io-client';

export default function SeatMap() {
  const { building, floor } = useParams();
  const navigate = useNavigate();
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [activeReservation, setActiveReservation] = useState(null);

  useEffect(() => {
    const fetchActiveReservation = async () => {
      try {
        const data = await apiClient('/api/reservations/me/current');
        setActiveReservation(data.reservation);
      } catch {
        setActiveReservation(null);
      }
    };

    fetchActiveReservation();

    // Fetch seats
    const fetchSeats = async () => {
      try {
        const data = await apiClient(`/api/floors/${building}/${floor}/seats`);
        setSeats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSeats();

    // Socket connection
    const socketUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const socket = io(`${socketUrl}/floor/${building}-${floor}`);

    socket.on('seat_status_update', (update) => {
      setSeats((prev) =>
        prev.map((s) => s.seatId === update.seatId ? { ...s, status: update.status } : s)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [building, floor]);

  const handleSeatClick = (seat) => {
    if (seat.status === 'disabled') return;
    setSelectedSeat(seat);
  };

  const handleReserve = async () => {
    if (!selectedSeat) return;
    setReserving(true);
    try {
      const response = await apiClient('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({ seatId: selectedSeat.seatId })
      });
      // Redirect to receipt
      navigate('/receipt', {
        state: {
          reservation: response.reservation,
          qrToken: response.qrToken
        }
      });
    } catch (err) {
      alert(`Failed to reserve: ${err.message}`);
    } finally {
      setReserving(false);
      setSelectedSeat(null);
    }
  };

  const getSeatColor = (status) => {
    switch (status) {
      case 'available': return '#22c55e'; // green-500
      case 'occupied': return '#ef4444'; // red-500
      case 'pending':
      case 'pending_entry':
        return '#f59e0b'; // amber-500
      case 'on_break':
        return '#3b82f6'; // blue-500
      default: return '#9ca3af'; // gray-400
    }
  };

  const handleOpenActiveReservation = () => {
    if (!activeReservation) return;
    navigate('/receipt', {
      state: {
        reservation: activeReservation,
        qrToken: activeReservation.seat?.currentQrToken || null
      }
    });
  };

  const handleFlagSeat = async (seatId) => {
    if (!confirm('Are you sure this seat is vacant? This will notify the reservation holder.')) return;
    try {
      await apiClient(`/api/seats/${seatId}/flag`, { method: 'POST' });
      alert('Seat flagged. The holder has been notified.');
      setSelectedSeat(null);
    } catch (err) {
      alert(`Flag failed: ${err.message}`);
    }
  };

  const buildingName = building.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-gray-800">
          {buildingName} - Floor {floor}
        </h1>
        <div className="flex items-center gap-3">
          {activeReservation && (
            <button
              onClick={handleOpenActiveReservation}
              className="rounded bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
            >
              My Reservation
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="text-sm text-blue-600 hover:underline"
          >
            Change Location
          </button>
        </div>
      </div>

      {activeReservation && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You currently have a reservation in progress. Open the receipt to track status, break time, or flagging alerts.
        </div>
      )}

      {loading ? (
        <div className="text-center p-10">Loading map...</div>
      ) : error ? (
        <div className="text-red-500 p-4 border border-red-200 rounded">{error}</div>
      ) : (
        <div className="relative border-2 border-gray-200 rounded-lg bg-gray-50 overflow-hidden shadow-inner">
          <svg viewBox="0 0 1000 700" className="w-full h-auto bg-gray-50">
            {/* Draw walls/grid placeholders if desired here */}
            {seats.map((seat) => (
              <g
                key={seat.seatId}
                transform={`translate(${seat.posX || 0}, ${seat.posY || 0})`}
                onClick={() => handleSeatClick(seat)}
                className={seat.status === 'available' ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-not-allowed opacity-90'}
              >
                {seat.seatType === 'table_node' ? (
                  <circle cx="20" cy="20" r="30" fill={getSeatColor(seat.status)} stroke="#fff" strokeWidth="3" />
                ) : (
                  <rect width="40" height="40" rx="4" fill={getSeatColor(seat.status)} stroke="#fff" strokeWidth="2" />
                )}
                {/* Optional: Add text or icons inside */}
              </g>
            ))}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white p-3 rounded shadow-md text-xs flex gap-4">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded"></div> Available</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded"></div> Pending</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> Occupied</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded"></div> On Break</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-400 rounded"></div> Disabled</div>
          </div>
        </div>
      )}

      {/* Confirmation/Action Modal */}
      {selectedSeat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            {selectedSeat.status === 'available' ? (
              <>
                <h3 className="text-lg font-bold mb-2">Reserve this seat?</h3>
                <p className="text-sm text-gray-600 mb-6">
                  You will have 5 minutes to confirm your reservation at the front desk.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedSeat(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    disabled={reserving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReserve}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={reserving}
                  >
                    {reserving ? 'Reserving...' : 'Confirm'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold mb-2">Seat is {selectedSeat.status.replace('_', ' ')}</h3>
                <p className="text-sm text-gray-600 mb-6">
                  If this seat appears vacant in person, you can flag it to notify the owner.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedSeat(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleFlagSeat(selectedSeat.seatId)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Flag as Vacant
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
