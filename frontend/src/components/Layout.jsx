/**
 * Shared page layout with header navigation.
 */
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { ChartBar, MapTrifold, Monitor, ShieldCheck, SignOut, Ticket, UserCircle } from '@phosphor-icons/react';
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

  const navClass = ({ isActive }) => `ui-nav-item ${isActive ? 'ui-nav-item-active' : ''}`;
  const sampleLabel = !canUseProtectedApi && user ? `Sample ${user.role}` : user?.role;

  return (
    <div className="app-shell flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[linear-gradient(135deg,#032946_0%,#063a64_54%,#0b4d7a_100%)] text-white shadow-[0_12px_36px_rgba(3,41,70,0.22)]">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="AdDU Seats home">
            <span className="grid h-10 w-10 place-items-center rounded-[8px] border border-white/25 bg-white text-base font-bold text-[#063a64] shadow-[0_10px_24px_rgba(3,41,70,0.24)]">A</span>
            <span className="leading-none">
              <span className="block text-[15px] font-semibold">AdDU Seats</span>
              <span className="mt-1 hidden text-[11px] font-medium text-blue-100/70 sm:block">University Libraries</span>
            </span>
          </Link>

          {user ? (
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary navigation">
                <NavLink to="/" end className={navClass} aria-label="Seat map" title="Seat map">
                  <MapTrifold size={18} weight="bold" />
                  <span className="hidden sm:inline">Seat map</span>
                </NavLink>
                {user.role === 'student' && (
                  <button onClick={handleOpenMyReservation} className="ui-nav-item" aria-label="Open reservation" title="Open reservation">
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
              <div className="hidden min-w-0 items-center gap-2 rounded-[8px] bg-white/10 px-3 py-2 lg:flex">
                {canUseProtectedApi ? (
                  <ShieldCheck size={21} weight="duotone" className="shrink-0 text-amber-200" />
                ) : (
                  <UserCircle size={22} weight="duotone" className="shrink-0 text-blue-100/80" />
                )}
                <span className="min-w-0 leading-tight">
                  <span className="block max-w-36 truncate text-xs font-semibold">{user.name}</span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase text-blue-100/60">{sampleLabel}</span>
                </span>
              </div>
              <button onClick={handleLogout} className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] text-blue-100/80 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
                <SignOut size={20} weight="bold" />
              </button>
            </div>
          ) : (
            <nav className="flex items-center gap-2 text-sm">
              <Link to="/" className="hidden min-h-10 items-center rounded-[8px] px-3 font-semibold text-blue-100/80 hover:bg-white/10 hover:text-white sm:inline-flex">Browse seats</Link>
              <Link to="/login" className="inline-flex min-h-10 items-center rounded-[8px] bg-white px-4 py-2 font-semibold text-[#063a64] shadow-[0_10px_26px_rgba(3,41,70,0.22)] hover:bg-blue-50">
                Sign in
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      <footer className="border-t border-slate-200/80 bg-white/70 px-4 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span>Ateneo de Davao University Library Services</span>
          <span className="font-medium text-slate-600">Gisbert capacity: 591 mapped nodes</span>
        </div>
      </footer>
    </div>
  );
}
