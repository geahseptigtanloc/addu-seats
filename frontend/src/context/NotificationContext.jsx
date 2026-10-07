import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, ClockCountdown, WarningCircle, X } from '@phosphor-icons/react';
import { io } from 'socket.io-client';
import AppDialog from '../components/AppDialog.jsx';
import { API_URL, apiClient, getToken } from '../api/client.js';
import { formatSeatLocation } from '../data/seatLocations.js';
import { useAuth } from './AuthContext.jsx';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;
const NotificationContext = createContext(null);

function seenStorageKey(userId) {
  return `addu_seats_seen_flags_${userId}`;
}

function readSeenIds(userId) {
  try {
    const value = JSON.parse(sessionStorage.getItem(seenStorageKey(userId)) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function storeSeenIds(userId, ids) {
  try {
    sessionStorage.setItem(seenStorageKey(userId), JSON.stringify([...ids].slice(-100)));
  } catch {
    // Notifications still work when browser storage is unavailable.
  }
}

function adminNotification(report, unread) {
  return {
    id: report.flagId || report.reservationId,
    reservationId: report.reservationId,
    title: 'Possible ghost seat',
    location: formatSeatLocation(report),
    message: `${report.seatLabel || 'A seat'} was reported vacant${report.studentName ? ` for ${report.studentName}` : ''}.`,
    seatLabel: report.seatLabel,
    createdAt: report.reportedAt || new Date().toISOString(),
    href: '/admin#ghost-reports',
    kind: 'flag',
    unread,
  };
}

function pendingReservationNotification(reservation, unread) {
  const reservationId = reservation.reservationId || reservation.id;
  const seatLabel = reservation.seatLabel || reservation.seat?.label || 'A seat';
  return {
    id: `pending:${reservationId}`,
    reservationId,
    title: 'New seat reservation',
    location: formatSeatLocation(reservation),
    message: `${reservation.studentName || reservation.user?.name || 'A student'} reserved ${seatLabel}. Entry approval is pending.`,
    seatLabel,
    createdAt: reservation.createdAt || new Date().toISOString(),
    href: '/frontdesk',
    kind: 'reservation',
    unread,
  };
}

function studentNotification(flag, seat, reservationId, unread) {
  const seatLabel = flag.seatLabel || seat?.label || 'Your reserved seat';
  return {
    id: flag.flagId || reservationId,
    reservationId,
    title: 'Your seat was reported vacant',
    location: formatSeatLocation({ ...flag, seat }),
    message: `${seatLabel} needs a verify QR scan before the report expires.`,
    seatLabel,
    createdAt: flag.flaggedAt || new Date().toISOString(),
    href: '/receipt',
    kind: 'flag',
    unread,
  };
}

function upsertNotification(current, incoming) {
  const existing = current.find((item) => item.id === incoming.id);
  const merged = existing ? { ...incoming, unread: existing.unread || incoming.unread } : incoming;
  return [merged, ...current.filter((item) => item.id !== incoming.id)].slice(0, 20);
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const seenIdsRef = useRef(new Set());
  const [notifications, setNotifications] = useState([]);
  const [holderAlert, setHolderAlert] = useState(null);
  const [adminToast, setAdminToast] = useState(null);

  useEffect(() => {
    setNotifications([]);
    setHolderAlert(null);
    setAdminToast(null);

    if (!user) return undefined;

    const controller = new AbortController();
    const token = getToken();
    seenIdsRef.current = readSeenIds(user.id);

    if (user.role === 'admin') {
      Promise.all([
        apiClient('/api/reservations/flagged', { signal: controller.signal }),
        apiClient('/api/reservations/pending', { signal: controller.signal }),
      ])
        .then(([reports, pendingReservations]) => {
          setNotifications((current) => {
            let next = current;
            if (Array.isArray(reports)) {
              next = reports.reduce(
                (items, report) => upsertNotification(items, adminNotification(
                  report,
                  !seenIdsRef.current.has(report.flagId || report.reservationId),
                )),
                next,
              );
            }
            if (Array.isArray(pendingReservations)) {
              next = pendingReservations.reduce(
                (items, reservation) => {
                  const notification = pendingReservationNotification(reservation, false);
                  notification.unread = !seenIdsRef.current.has(notification.id);
                  return upsertNotification(items, notification);
                },
                next,
              );
            }
            return next;
          });
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setNotifications([]);
        });
    } else if (user.role === 'student') {
      apiClient('/api/reservations/me/current', { signal: controller.signal })
        .then((payload) => {
          const reservation = payload?.reservation || payload;
          if (!reservation?.flag) return;
          const notification = studentNotification(
            reservation.flag,
            reservation.seat,
            reservation.reservationId || reservation.id,
            !seenIdsRef.current.has(reservation.flag.flagId),
          );
          setNotifications((current) => upsertNotification(current, notification));
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setNotifications([]);
        });
    }

    if (!token) return () => controller.abort();

    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on('seat_flagged', (payload) => {
      if (user.role !== 'student') return;
      const notification = studentNotification(
        payload,
        { label: payload.seatLabel },
        payload.reservationId,
        true,
      );
      setNotifications((current) => upsertNotification(current, notification));
      setHolderAlert(payload);
    });

    socket.on('seat_flagged_admin_notice', (payload) => {
      if (user.role !== 'admin') return;
      const notification = adminNotification(payload, true);
      setNotifications((current) => upsertNotification(current, notification));
      setAdminToast({ type: 'flag', payload });
    });

    socket.on('reservation_pending_admin_notice', (payload) => {
      if (user.role !== 'admin') return;
      const notification = pendingReservationNotification(payload, true);
      setNotifications((current) => upsertNotification(current, notification));
      setAdminToast({ type: 'reservation', payload });
    });

    socket.on('reservation_pending_resolved_admin_notice', ({ reservationId }) => {
      if (user.role !== 'admin') return;
      setNotifications((current) => current.filter((item) => (
        item.id !== `pending:${reservationId}`
      )));
      setAdminToast((current) => (
        current?.type === 'reservation' && current.payload?.reservationId === reservationId
          ? null
          : current
      ));
    });

    socket.on('seat_flag_resolved_admin_notice', ({ flagId, reservationId }) => {
      if (user.role !== 'admin') return;
      setNotifications((current) => current.filter((item) => (
        item.id !== flagId && item.reservationId !== reservationId
      )));
    });

    socket.on('reservation_evicted', ({ reservationId }) => {
      setNotifications((current) => current.filter((item) => item.reservationId !== reservationId));
      setHolderAlert(null);
    });

    return () => {
      controller.abort();
      socket.disconnect();
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!adminToast) return undefined;
    const timer = window.setTimeout(() => setAdminToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [adminToast]);

  const markAllRead = useCallback(() => {
    if (!user) return;
    setNotifications((current) => {
      current.forEach((item) => seenIdsRef.current.add(item.id));
      storeSeenIds(user.id, seenIdsRef.current);
      return current.map((item) => ({ ...item, unread: false }));
    });
  }, [user]);

  const clearReservationNotification = useCallback((reservationId) => {
    setNotifications((current) => current.filter((item) => item.reservationId !== reservationId));
    setHolderAlert((current) => current?.reservationId === reservationId ? null : current);
  }, []);

  const value = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((item) => item.unread).length,
    markAllRead,
    clearReservationNotification,
  }), [clearReservationNotification, markAllRead, notifications]);

  const toastNotification = adminToast && (
    adminToast.type === 'reservation'
      ? pendingReservationNotification(adminToast.payload, false)
      : adminNotification(adminToast.payload, false)
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <AppDialog
        open={Boolean(holderAlert)}
        tone="danger"
        title="Your seat was reported vacant"
        description={holderAlert ? `${holderAlert.seatLabel || 'Your reserved seat'} was flagged. Return to the seat and scan its verify QR before the verification window expires.` : ''}
        confirmLabel="Open reservation"
        cancelLabel="Dismiss for now"
        onConfirm={() => {
          setHolderAlert(null);
          navigate('/receipt');
        }}
        onClose={() => setHolderAlert(null)}
      />

      {adminToast && (
        <div className={`fixed right-4 top-20 z-[70] w-[calc(100%-2rem)] max-w-sm rounded-[8px] border bg-white p-4 shadow-[0_22px_64px_rgba(15,23,42,0.22)] ${adminToast.type === 'reservation' ? 'border-blue-200' : 'border-red-200'}`} role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${adminToast.type === 'reservation' ? 'bg-blue-100 text-[#063a64]' : 'bg-red-100 text-red-700'}`}>
              {adminToast.type === 'reservation'
                ? <ClockCountdown size={22} weight="fill" />
                : <WarningCircle size={22} weight="fill" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-950">{adminToast.type === 'reservation' ? 'New seat reservation' : 'New ghost-seat report'}</p>
              <p className="mt-1 text-xs font-semibold text-[#063a64]">{toastNotification.location}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {toastNotification.message}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAdminToast(null);
                  navigate(adminToast.type === 'reservation' ? '/frontdesk' : '/admin#ghost-reports');
                }}
                className={`mt-3 inline-flex items-center gap-2 text-sm font-semibold ${adminToast.type === 'reservation' ? 'text-[#063a64] hover:text-[#032946]' : 'text-red-700 hover:text-red-900'}`}
              >
                {adminToast.type === 'reservation' ? 'Open front desk' : 'Review report'} <ArrowRight size={16} weight="bold" />
              </button>
            </div>
            <button type="button" onClick={() => setAdminToast(null)} className="ui-icon-button h-8 w-8 border-transparent" aria-label="Dismiss notification">
              <X size={17} weight="bold" />
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function NotificationBell() {
  const context = useNotifications();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event) {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          context.markAllRead();
        }}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[8px] text-blue-100/85 hover:bg-white/10 hover:text-white"
        aria-label={context.unreadCount ? `${context.unreadCount} unread seat notifications` : 'Seat notifications'}
        aria-expanded={open}
      >
        <Bell size={21} weight={context.unreadCount ? 'fill' : 'bold'} />
        {context.unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-[#063a64] bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {context.unreadCount > 9 ? '9+' : context.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-[68px] z-50 overflow-hidden rounded-[8px] border border-slate-200 bg-white text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-950">Seat notifications</p>
              <p className="mt-0.5 text-xs text-slate-500">Pending reservations and active reports</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="ui-icon-button h-8 w-8 border-transparent" aria-label="Close notifications">
              <X size={16} weight="bold" />
            </button>
          </div>

          {context.notifications.length ? (
            <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {context.notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(notification.href);
                  }}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-slate-50"
                >
                  <span className={`relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[8px] ${notification.kind === 'reservation' ? 'bg-blue-50 text-[#063a64]' : 'bg-red-50 text-red-700'}`}>
                    {notification.kind === 'reservation'
                      ? <ClockCountdown size={20} weight="duotone" />
                      : <WarningCircle size={20} weight="duotone" />}
                    {notification.unread && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-600" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-950">{notification.title}</span>
                    <span className="mt-1 inline-block rounded-[6px] bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-[#063a64]">{notification.location}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">{notification.message}</span>
                  </span>
                  <ArrowRight size={16} weight="bold" className="mt-2 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <Bell size={24} weight="duotone" className="mx-auto text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-800">No active seat alerts</p>
              <p className="mt-1 text-xs text-slate-500">New reservations and flag reports will appear here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
