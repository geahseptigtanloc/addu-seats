import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { apiClient } from '../api/client.js';

export default function BuildingFloorSelector() {
  const [building, setBuilding] = useState('gisbert');
  const [floor, setFloor] = useState('1');
  const [activeReservation, setActiveReservation] = useState(null);
  const navigate = useNavigate();

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
  }, []);

  const handleBuildingChange = (e) => {
    const newBuilding = e.target.value;
    setBuilding(newBuilding);
    setFloor('1'); // Reset to floor 1 when building changes
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(`/map/${building}/${floor}`);
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

  const floors = building === 'gisbert' ? [1, 2, 3, 4] : [1];

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-10">
        {activeReservation && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">You have an active reservation</p>
                <p className="text-amber-700">Seat {activeReservation.seatId.slice(0, 8)} • Status: {activeReservation.status}</p>
              </div>
              <button
                type="button"
                onClick={handleOpenActiveReservation}
                className="rounded bg-amber-600 px-3 py-2 font-medium text-white hover:bg-amber-700"
              >
                View Receipt
              </button>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Select Location</h1>
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Building
            </label>
            <select
              value={building}
              onChange={handleBuildingChange}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
            >
              <option value="gisbert">Gisbert Library</option>
              <option value="miguel_pro">Miguel Pro</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Floor
            </label>
            <select
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:border-blue-300"
            >
              {floors.map(f => (
                <option key={f} value={f}>Floor {f}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none"
          >
            View Map
          </button>
        </form>
      </div>
    </Layout>
  );
}
