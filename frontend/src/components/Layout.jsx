/**
 * Shared page layout with header navigation.
 */
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { ChartBar, MapTrifold, Monitor, SignOut, Ticket, UserCircle } from '@phosphor-icons/react';
import { apiClient } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getDemoReservation } from '../data/demoReservationStore.js';

export default function Layout({ children }) {
  const { user, logout, canUseProtectedApi } = useAuth();
  const navigate = useNavigate();

  async function handleOpenMyReservation() {
    if (!canUseProtectedApi) {
      const reservation = getDemoReservation();
      if (!reservation) {
        alert('You do not have a reservation in progress right now.');
        return;
      }
      navigate('/receipt', {
        state: {
          reservation,
          qrToken: reservation.qrToken,
          isDemo: true,
        },
      });
      return;
    }

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
    navigate('/');
  }

  const navClass = ({ isActive }) => `flex min-h-11 items-center gap-2 border-b-2 px-1 text-sm font-medium ${
    isActive
      ? 'border-amber-400 text-white'
      : 'border-transparent text-slate-300 hover:border-white/30 hover:text-white'
  }`;

  return (
    <div className="flex min-h-screen flex-col bg-[#f2f5f7]">
      <header className="border-b border-white/10 bg-[#062f52] text-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="AdDU Seats home">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-white/20 bg-white text-base font-bold text-[#073b66]">A</span>
            <span className="leading-none">
              <span className="block text-[15px] font-semibold">AdDU Seats</span>
              <span className="mt-1 hidden text-[11px] text-slate-300 sm:block">University Libraries</span>
            </span>
          </Link>

          {user ? (
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <nav className="flex items-center gap-4 sm:gap-6" aria-label="Primary navigation">
                <NavLink to="/" end className={navClass} aria-label="Seat map" title="Seat map">
                  <MapTrifold size={18} weight="bold" />
                  <span className="hidden sm:inline">Seat map</span>
                </NavLink>
                {user.role === 'student' && (
                  <button onClick={handleOpenMyReservation} className="flex min-h-11 items-center gap-2 border-b-2 border-transparent px-1 text-sm font-medium text-slate-300 hover:border-white/30 hover:text-white">
                    <Ticket size={18} weight="bold" />
                    <span className="hidden sm:inline">Reservation</span>
                  </button>
                )}
                {['staff', 'admin'].includes(user.role) && (
                  <NavLink to="/frontdesk" className={navClass} aria-label="Front desk" title="Front desk">
                    <Monitor size={18} weight="bold" />
                    <span className="hidden sm:inline">Front desk</span>
                  </NavLink>
                )}
                {user.role === 'admin' && (
                  <NavLink to="/admin" className={navClass} aria-label="Dashboard" title="Dashboard">
                    <ChartBar size={18} weight="bold" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </NavLink>
                )}
              </nav>

              <div className="hidden h-8 w-px bg-white/15 lg:block" />
              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <UserCircle size={24} className="shrink-0 text-slate-300" />
                <span className="min-w-0 leading-tight">
                  <span className="block max-w-36 truncate text-xs font-semibold">{user.name}</span>
                  <span className="mt-0.5 block text-[10px] uppercase text-slate-400">{!canUseProtectedApi ? 'Sample ' : ''}{user.role}</span>
                </span>
              </div>
              <button onClick={handleLogout} className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
                <SignOut size={20} weight="bold" />
              </button>
            </div>
          ) : (
            <nav className="flex items-center gap-2 text-sm">
              <Link to="/" className="hidden px-3 py-2 font-medium text-slate-300 hover:text-white sm:inline-flex">Browse seats</Link>
              <Link to="/login" className="inline-flex min-h-10 items-center rounded-md bg-white px-4 py-2 font-semibold text-[#073b66] hover:bg-slate-100">
                Sign in
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      <footer className="border-t border-slate-200 bg-[#f7f9fb] px-4 py-4 text-center text-xs text-slate-500">
        Ateneo de Davao University Library Services
      </footer>
    </div>
  );
}
