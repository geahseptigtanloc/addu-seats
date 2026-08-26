import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { apiClient, getToken } from '../api/client.js';
import { useSocket } from '../hooks/useSocket.js';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function FrontDeskView() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState('');
  const navigate = useNavigate();

  // Socket for staff real-time updates (flag notifications)
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket = io(`${SOCKET_URL}/user`, {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('[FrontDesk] Connected to /user namespace (staff-room)');
    });

    socket.on('flag_raised', (data) => {
      // In a real app we might show a nice toast notification here
      alert(`⚠️ STAFF ALERT: Seat flagged as vacant on Floor ${data.floor} in ${data.building.replace('_', ' ')}.`);
    });

    socket.on('flag_resolved', (data) => {
      console.log('Flag resolved', data);
    });

    return () => socket.disconnect();
  }, []);

  const fetchQueue = async () => {
    try {
      const data = await apiClient('/api/frontdesk/pending');
      setQueue(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Format countdown string
  const getCountdown = (deadlineStr) => {
    if (!deadlineStr) return '';
    const diff = new Date(deadlineStr).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // State to force re-render for countdowns
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id) => {
    try {
      await apiClient(`/api/frontdesk/verify/${id}`, {
        method: 'POST',
        body: JSON.stringify({ approved: true })
      });
      fetchQueue();
    } catch (err) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleReject = async (id) => {
    if (!reason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    try {
      await apiClient(`/api/frontdesk/verify/${id}`, {
        method: 'POST',
        body: JSON.stringify({ approved: false, rejectionReason: reason })
      });
      setRejectingId(null);
      setReason('');
      fetchQueue();
    } catch (err) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto mt-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Front Desk Queue</h1>

        {error && <div className="text-red-500 p-4 border border-red-200 bg-red-50 mb-6 rounded">{error}</div>}

        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600 uppercase tracking-wider">AdDU ID</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600 uppercase tracking-wider">Time Left</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && queue.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">Loading queue...</td></tr>
              ) : queue.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No pending reservations</td></tr>
              ) : (
                queue.map((res) => {
                  const timeLeft = new Date(res.entryDeadline).getTime() - Date.now();
                  const isUrgent = timeLeft < 60000 && timeLeft > 0;
                  const isExpired = timeLeft <= 0;

                  return (
                    <tr key={res.reservationId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{res.user.name}</td>
                      <td className="px-6 py-4 text-gray-600">{res.user.adduIdLast4 || 'N/A'}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {res.seat.building.replace('_', ' ')} - Fl {res.seat.floor}
                      </td>
                      <td className={`px-6 py-4 font-mono font-bold ${isExpired ? 'text-gray-400' : isUrgent ? 'text-red-600' : 'text-blue-600'}`}>
                        {getCountdown(res.entryDeadline)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {rejectingId === res.reservationId ? (
                          <div className="flex flex-col items-end gap-2">
                            <input 
                              type="text" 
                              placeholder="Reason for rejection"
                              value={reason}
                              onChange={e => setReason(e.target.value)}
                              className="text-sm p-1 border rounded"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => setRejectingId(null)} className="text-sm text-gray-500 hover:underline">Cancel</button>
                              <button onClick={() => handleReject(res.reservationId)} className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">Confirm Reject</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setRejectingId(res.reservationId)}
                              disabled={isExpired}
                              className="px-3 py-1 text-sm bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 font-medium"
                            >
                              Reject
                            </button>
                            <button 
                              onClick={() => handleApprove(res.reservationId)}
                              disabled={isExpired}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium shadow-sm"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
