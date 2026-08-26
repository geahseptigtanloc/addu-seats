/**
 * Shared page layout with header navigation.
 */
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleOpenMyReservation() {
    try {
      const data = await apiClient('/api/reservations/me/current');
      navigate('/receipt', {
        state: {
          reservation: data.reservation,
          qrToken: data.qrToken
        }
      });
    } catch (err) {
      alert('You do not have an active reservation to view right now.');
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-addu-blue text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            AdDU-Seats
          </Link>

          {user && (
            <nav className="flex items-center gap-3 text-sm">
              <Link to="/" className="hover:text-addu-gold transition-colors">
                Seat Map
              </Link>
              {user.role === 'student' && (
                <button
                  onClick={handleOpenMyReservation}
                  className="rounded bg-white/10 px-3 py-1 font-medium text-white hover:bg-white/20 transition-colors"
                >
                  My Reservation
                </button>
              )}
              {['staff', 'admin'].includes(user.role) && (
                <Link to="/frontdesk" className="hover:text-addu-gold transition-colors">
                  Front Desk
                </Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className="hover:text-addu-gold transition-colors">
                  Admin
                </Link>
              )}
              <span className="text-white/70">{user.name}</span>
              <button
                onClick={handleLogout}
                className="rounded bg-white/10 px-3 py-1 hover:bg-white/20 transition-colors"
              >
                Sign out
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
