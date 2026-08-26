import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { apiClient } from '../api/client.js';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No verification token provided');
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const data = await apiClient(`/api/frontdesk/lookup/${encodeURIComponent(token)}`);
        setReservation(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleApprove = async () => {
    try {
      await apiClient(`/api/frontdesk/verify/${reservation.reservationId}`, {
        method: 'POST',
        body: JSON.stringify({ approved: true })
      });
      alert('Approved successfully');
      navigate('/frontdesk');
    } catch (err) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    try {
      await apiClient(`/api/frontdesk/verify/${reservation.reservationId}`, {
        method: 'POST',
        body: JSON.stringify({ approved: false, rejectionReason: reason })
      });
      alert('Rejected successfully');
      navigate('/frontdesk');
    } catch (err) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-8 bg-white p-6 rounded-lg shadow border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">Verify Reservation</h1>
        
        {loading ? (
          <p className="text-gray-500">Loading reservation data...</p>
        ) : error ? (
          <div className="text-red-500 p-4 border border-red-200 bg-red-50 rounded mb-4">
            {error}
          </div>
        ) : (
          <div>
            {reservation.alreadyVerified ? (
              <div className="space-y-4">
                <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 font-medium">
                  This reservation has already been approved and is active.
                </div>
                <div className="mb-4">
                  <span className="text-sm text-gray-500 block">Student Name</span>
                  <span className="font-semibold text-lg">{reservation.user.name}</span>
                </div>

                <div className="mb-4">
                  <span className="text-sm text-gray-500 block">AdDU ID Last 4</span>
                  <span className="font-mono text-lg">{reservation.user.adduIdLast4 || 'N/A'}</span>
                </div>

                <div className="mb-2">
                  <span className="text-sm text-gray-500 block">Seat Location</span>
                  <span className="font-semibold text-lg text-blue-700">
                    {reservation.seat.building.replace('_', ' ')} - Floor {reservation.seat.floor}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <span className="text-sm text-gray-500 block">Student Name</span>
                  <span className="font-semibold text-lg">{reservation.user.name}</span>
                </div>
                
                <div className="mb-4">
                  <span className="text-sm text-gray-500 block">AdDU ID Last 4</span>
                  <span className="font-mono text-lg">{reservation.user.adduIdLast4 || 'N/A'}</span>
                </div>
                
                <div className="mb-8">
                  <span className="text-sm text-gray-500 block">Seat Location</span>
                  <span className="font-semibold text-lg text-blue-700">
                    {reservation.seat.building.replace('_', ' ')} - Floor {reservation.seat.floor}
                  </span>
                </div>

                {rejecting ? (
                  <div className="flex flex-col gap-3">
                    <input 
                      type="text" 
                      placeholder="Reason for rejection..."
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={() => setRejecting(false)} 
                        className="flex-1 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleReject} 
                        className="flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold"
                      >
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setRejecting(true)}
                      className="flex-1 py-3 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 font-bold"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={handleApprove}
                      className="flex-1 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-md"
                    >
                      Approve Entry
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
