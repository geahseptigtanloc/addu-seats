import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { apiClient, API_URL } from '../api/client.js';
import { getFloorLayout } from '../data/gisbertFloorLayouts.js';
import { getGisbertPreviewSeats } from '../data/gisbertPreviewSeats.js';
import {
  createDemoReservation,
  getDemoReservation,
  subscribeToDemoReservation,
} from '../data/demoReservationStore.js';
import { useAuth } from '../context/AuthContext.jsx';
import { io } from 'socket.io-client';
import { ArrowLeft, Check, Clock, Minus, Plus, Ticket, X } from '@phosphor-icons/react';

const DEFAULT_LAYOUT = {
  name: 'Floor Map',
  width: 1000,
  height: 700,
  features: [],
};

const STATUS_LABELS = {
  available: 'Available',
  pending: 'Pending',
  pending_entry: 'Pending',
  occupied: 'Occupied',
  on_break: 'On break',
  disabled: 'Disabled',
};

function getSeatColor(status) {
  switch (status) {
    case 'available':
      return '#059669';
    case 'occupied':
      return '#dc2626';
    case 'pending':
    case 'pending_entry':
      return '#d97706';
    case 'on_break':
      return '#2563eb';
    default:
      return '#9ca3af';
  }
}

function getSeatTypeLabel(seatType) {
  if (seatType === 'table_node') return 'Collaborative table';
  if (seatType === 'cubicle') return 'Study cubicle';
  return 'Individual seat';
}

function getSeatRotation(seat, features) {
  if (seat.seatType !== 'individual') return 0;
  const desks = features.filter((feature) => feature.type === 'desk');
  let nearestDesk = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  desks.forEach((desk) => {
    const right = desk.x + desk.width;
    const bottom = desk.y + desk.height;
    const distanceX = Math.max(desk.x - seat.posX, 0, seat.posX - right);
    const distanceY = Math.max(desk.y - seat.posY, 0, seat.posY - bottom);
    const distance = Math.hypot(distanceX, distanceY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestDesk = desk;
    }
  });

  if (!nearestDesk) return 0;
  const centerX = nearestDesk.x + nearestDesk.width / 2;
  const centerY = nearestDesk.y + nearestDesk.height / 2;
  const outsideX = Math.max(0, Math.abs(seat.posX - centerX) - nearestDesk.width / 2);
  const outsideY = Math.max(0, Math.abs(seat.posY - centerY) - nearestDesk.height / 2);
  return outsideX > outsideY ? 90 : 0;
}

function applyCanonicalPositions(seats, building, floor) {
  if (building !== 'gisbert') return seats;
  const canonicalByLabel = new Map(
    getGisbertPreviewSeats(floor).map((seat) => [seat.label, seat]),
  );

  return seats.map((seat) => {
    const canonical = canonicalByLabel.get(seat.label);
    if (!canonical) return seat;
    return { ...seat, posX: canonical.posX, posY: canonical.posY };
  });
}

function FeatureText({ x, y, text, fontSize = 13, vertical = false, anchor = 'middle' }) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const lineHeight = fontSize * 1.15;
  const firstLineOffset = -((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      transform={vertical ? `rotate(-90 ${x} ${y})` : undefined}
      fontSize={fontSize}
      fontWeight="500"
      fill="#111827"
      pointerEvents="none"
    >
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? firstLineOffset : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function LayoutFeature({ feature, hatchId }) {
  switch (feature.type) {
    case 'room': {
      const centerX = feature.x + feature.width / 2;
      const centerY = feature.y + feature.height / 2;
      return (
        <g>
          <rect
            x={feature.x}
            y={feature.y}
            width={feature.width}
            height={feature.height}
            fill="#ffffff"
            stroke="#111827"
            strokeWidth="1.5"
          />
          <FeatureText
            x={centerX}
            y={centerY}
            text={feature.label}
            fontSize={feature.fontSize}
            vertical={feature.verticalLabel}
          />
        </g>
      );
    }
    case 'bookcase': {
      const centerX = feature.x + feature.width / 2;
      const centerY = feature.y + feature.height / 2;
      return (
        <g>
          <rect
            x={feature.x}
            y={feature.y}
            width={feature.width}
            height={feature.height}
            fill="#e5e7eb"
            stroke="#374151"
            strokeWidth="1.2"
          />
          <rect
            x={feature.x + 2}
            y={feature.y + 2}
            width={Math.max(feature.width - 4, 0)}
            height={Math.max(feature.height - 4, 0)}
            fill={`url(#${hatchId})`}
            opacity="0.35"
          />
          <FeatureText
            x={centerX}
            y={centerY}
            text={feature.label}
            fontSize={feature.fontSize}
            vertical={feature.verticalLabel}
          />
        </g>
      );
    }
    case 'desk':
      return (
        <rect
          x={feature.x}
          y={feature.y}
          width={feature.width}
          height={feature.height}
          rx="3"
          fill="#f8fafc"
          stroke="#111827"
          strokeWidth="1.5"
        />
      );
    case 'roundTable':
      return (
        <circle
          cx={feature.cx}
          cy={feature.cy}
          r={feature.radius}
          fill="#f8fafc"
          stroke="#111827"
          strokeWidth="1.5"
        />
      );
    case 'couch': {
      const centerX = feature.x + feature.width / 2;
      const centerY = feature.y + feature.height / 2;

      if (feature.curved) {
        return (
          <g>
            <path
              d={`M${feature.x} ${centerY} C${feature.x + 20} ${feature.y - 8}, ${feature.x + feature.width - 20} ${feature.y - 8}, ${feature.x + feature.width} ${centerY} C${feature.x + feature.width - 20} ${feature.y + feature.height + 8}, ${feature.x + 20} ${feature.y + feature.height + 8}, ${feature.x} ${centerY}`}
              fill="#f3f4f6"
              stroke="#111827"
              strokeWidth="1.5"
            />
            <FeatureText x={centerX} y={centerY} text={feature.label} fontSize={feature.fontSize} />
          </g>
        );
      }

      return (
        <g>
          <rect
            x={feature.x}
            y={feature.y}
            width={feature.width}
            height={feature.height}
            rx="5"
            fill="#f3f4f6"
            stroke="#111827"
            strokeWidth="1.5"
          />
          <FeatureText
            x={centerX}
            y={centerY}
            text={feature.label}
            fontSize={feature.fontSize}
            vertical={feature.verticalLabel}
          />
        </g>
      );
    }
    case 'curve':
      return (
        <path
          d={feature.d}
          fill="none"
          stroke="#6b7280"
          strokeWidth={feature.strokeWidth || 2}
          strokeLinecap="round"
        />
      );
    case 'quietZone':
      return (
        <g>
          <rect
            x={feature.x}
            y={feature.y}
            width={feature.width}
            height={feature.height}
            fill={`url(#${hatchId})`}
            opacity="0.4"
          />
          <FeatureText
            x={feature.x + feature.width / 2}
            y={feature.y + feature.height / 2}
            text={feature.label}
            fontSize={feature.fontSize || 16}
          />
        </g>
      );
    case 'label':
      return (
        <FeatureText
          x={feature.x}
          y={feature.y}
          text={feature.text}
          fontSize={feature.fontSize}
          vertical={feature.verticalLabel}
          anchor={feature.anchor}
        />
      );
    default:
      return null;
  }
}

function SeatMarker({ seat, index, onClick, rotation = 0 }) {
  const statusLabel = STATUS_LABELS[seat.status] || seat.status.replace('_', ' ');
  const nodeLabel = seat.label || `Seat ${index + 1}`;
  const fill = getSeatColor(seat.status);
  const isDisabled = seat.status === 'disabled';
  const markerClass = isDisabled
    ? 'seat-marker cursor-not-allowed opacity-65'
    : 'seat-marker cursor-pointer';

  return (
    <g
      transform={`translate(${seat.posX || 0}, ${seat.posY || 0})`}
      onClick={() => onClick(seat)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(seat);
        }
      }}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={`${nodeLabel}, ${getSeatTypeLabel(seat.seatType)}, ${statusLabel}`}
      aria-disabled={isDisabled}
      className={markerClass}
    >
      <title>{`${nodeLabel} - ${statusLabel}`}</title>
      <rect x="-8" y="-8" width="16" height="16" fill="transparent" />
      <circle className="seat-focus-ring" cx="0" cy="0" r="8" fill="none" stroke="#1d4ed8" strokeWidth="1.25" />
      {seat.seatType === 'table_node' ? (
        <g pointerEvents="none">
          <circle cx="0" cy="0" r="7" fill="#ffffff" />
          <circle cx="0" cy="0" r="5.25" fill={fill} />
          <circle cx="0" cy="0" r="2" fill="#ffffff" opacity="0.32" />
        </g>
      ) : (
        <g transform={`rotate(${rotation})`}>
          {selectedSeatShape(seat.seatType, fill)}
        </g>
      )}
    </g>
  );
}

function selectedSeatShape(seatType, fill) {
  if (seatType === 'cubicle') {
    return (
      <g pointerEvents="none">
        <rect x="-7" y="-5" width="14" height="10" rx="2.5" fill="#ffffff" />
        <rect x="-5.5" y="-3.5" width="11" height="7" rx="1.75" fill={fill} />
        <path d="M-4.5 -4.75 H4.5" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
      </g>
    );
  }

  return (
    <g pointerEvents="none">
      <rect x="-6" y="-5.5" width="12" height="11" rx="3" fill="#ffffff" />
      <rect x="-4.5" y="-3.25" width="9" height="7" rx="2" fill={fill} />
      <path d="M-3.75 -4.75 H3.75" stroke={fill} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

export default function SeatMap() {
  const { building, floor } = useParams();
  const navigate = useNavigate();
  const { user, canUseProtectedApi } = useAuth();
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [activeReservation, setActiveReservation] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const refreshDemoReservation = () => {
      if (user && !canUseProtectedApi) {
        setActiveReservation(getDemoReservation());
      }
    };

    refreshDemoReservation();
    return subscribeToDemoReservation(refreshDemoReservation);
  }, [user, canUseProtectedApi]);

  useEffect(() => {
    const fetchActiveReservation = async () => {
      if (!user) {
        setActiveReservation(null);
        return;
      }

      if (!canUseProtectedApi) {
        setActiveReservation(getDemoReservation());
        return;
      }

      try {
        const data = await apiClient('/api/reservations/me/current');
        setActiveReservation(data.reservation);
      } catch {
        setActiveReservation(null);
      }
    };

    fetchActiveReservation();

    const fetchSeats = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiClient(`/api/floors/${building}/${floor}/seats`);
        setSeats(applyCanonicalPositions(data, building, floor));
      } catch (err) {
        const previewSeats = building === 'gisbert' ? getGisbertPreviewSeats(floor) : [];
        setSeats(previewSeats);
        setError(previewSeats.length ? '' : err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSeats();

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
  }, [building, floor, user, canUseProtectedApi]);

  const handleSeatClick = (seat) => {
    if (seat.status === 'disabled') return;
    setAcknowledged(false);
    setSelectedSeat(seat);
  };

  const handleReserve = async () => {
    if (!selectedSeat || user?.role !== 'student' || !acknowledged) return;
    setReserving(true);
    try {
      const response = canUseProtectedApi
        ? await apiClient('/api/reservations', {
          method: 'POST',
          body: JSON.stringify({ seatId: selectedSeat.seatId })
        })
        : (() => {
          const reservation = createDemoReservation({ seat: selectedSeat, user });
          return { reservation, qrToken: reservation.qrToken };
        })();

      navigate('/receipt', {
        state: {
          reservation: response.reservation,
          qrToken: response.qrToken,
          isDemo: !canUseProtectedApi,
        }
      });
    } catch (err) {
      alert(`Failed to reserve: ${err.message}`);
    } finally {
      setReserving(false);
      setSelectedSeat(null);
    }
  };

  const handleOpenActiveReservation = () => {
    if (!activeReservation) return;
    navigate('/receipt', {
      state: {
        reservation: activeReservation,
        qrToken: activeReservation.qrToken || activeReservation.seat?.currentQrToken || null,
        isDemo: !canUseProtectedApi,
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

  const layout = getFloorLayout(building, floor) || DEFAULT_LAYOUT;
  const hatchId = `map-hatch-${building}-${floor}`;
  const demoReservation = !canUseProtectedApi ? activeReservation : null;
  const visibleSeats = seats.map((seat) => {
    if (demoReservation?.seat?.seatId !== seat.seatId) return seat;
    const status = demoReservation.status === 'pending_entry'
      ? 'pending'
      : demoReservation.status === 'active'
        ? 'occupied'
        : demoReservation.status;
    return { ...seat, status };
  });
  const sortedSeats = [...visibleSeats].sort((a, b) => (a.posY - b.posY) || (a.posX - b.posX));
  const selectedSeatNumber = selectedSeat
    ? sortedSeats.findIndex((seat) => seat.seatId === selectedSeat.seatId) + 1
    : 0;
  const selectedSeatLabel = selectedSeat?.label || `G${floor}-S${String(selectedSeatNumber).padStart(3, '0')}`;
  const availableCount = sortedSeats.filter((seat) => seat.status === 'available').length;
  const pendingCount = sortedSeats.filter((seat) => ['pending', 'pending_entry'].includes(seat.status)).length;
  const occupiedCount = sortedSeats.filter((seat) => seat.status === 'occupied').length;
  const breakCount = sortedSeats.filter((seat) => seat.status === 'on_break').length;
  const canReserve = selectedSeat?.status === 'available'
    && user?.role === 'student'
    && !activeReservation;
  const buildingName = building.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const setMapZoom = (nextZoom) => setZoom(Math.min(1.8, Math.max(0.8, nextZoom)));

  return (
    <Layout>
      <section className="mb-5 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <button type="button" onClick={() => navigate('/')} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#073b66] hover:text-[#052e50]">
            <ArrowLeft size={17} weight="bold" />
            All floors
          </button>
          <h1 className="ui-page-title">{buildingName} · Floor {floor}</h1>
          <p className="ui-muted mt-2">Select an available node to begin a reservation.</p>
        </div>
        {activeReservation && (
          <button type="button" onClick={handleOpenActiveReservation} className="ui-button-secondary self-start border-amber-300 bg-amber-50 text-amber-900">
            <Ticket size={18} weight="duotone" />
            Open reservation
          </button>
        )}
      </section>

      <section className="ui-panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 lg:pb-0" aria-label="Choose floor">
            <span className="mr-1 shrink-0 text-xs font-semibold text-slate-500">FLOOR</span>
            {[1, 2, 3, 4].map((floorNumber) => (
              <button
                key={floorNumber}
                type="button"
                onClick={() => navigate(`/map/${building}/${floorNumber}`)}
                aria-current={Number(floor) === floorNumber ? 'page' : undefined}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border text-sm font-semibold ${Number(floor) === floorNumber ? 'border-[#073b66] bg-[#073b66] text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'}`}
              >
                {floorNumber}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-600">
            <StatusKey color="bg-emerald-600" label="Available" value={availableCount} />
            <StatusKey color="bg-amber-600" label="Pending" value={pendingCount} />
            <StatusKey color="bg-red-600" label="Occupied" value={occupiedCount} />
            <StatusKey color="bg-blue-600" label="On break" value={breakCount} />
          </div>
        </div>

        {(user && !canUseProtectedApi) || activeReservation ? (
          <div className={`flex flex-col justify-between gap-3 border-b px-4 py-3 text-sm sm:flex-row sm:items-center ${activeReservation ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-blue-200 bg-blue-50 text-blue-950'}`}>
            <span>{activeReservation ? 'A reservation is already in progress. Finish or cancel it before choosing another node.' : 'Sample mode is active. Changes remain in this browser.'}</span>
            {activeReservation && <button type="button" onClick={handleOpenActiveReservation} className="self-start font-semibold underline decoration-2 underline-offset-4">View details</button>}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-[#f7f9fb] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{layout.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{availableCount} of {sortedSeats.length} nodes available</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMapZoom(zoom - 0.2)} disabled={zoom <= 0.8} className="ui-icon-button" aria-label="Zoom out" title="Zoom out"><Minus size={18} weight="bold" /></button>
            <span className="w-12 text-center text-xs font-semibold text-slate-600" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setMapZoom(zoom + 0.2)} disabled={zoom >= 1.8} className="ui-icon-button" aria-label="Zoom in" title="Zoom in"><Plus size={18} weight="bold" /></button>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-[480px] place-items-center bg-slate-100 text-sm font-medium text-slate-500">Loading floor map...</div>
        ) : error ? (
          <div className="m-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : (
          <div className="max-h-[72vh] min-h-[440px] overflow-auto bg-slate-200 p-3 sm:p-5">
            <div className="mx-auto origin-top" style={{ width: `${zoom * 100}%`, minWidth: zoom >= 1 ? '680px' : '560px' }}>
              <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="block h-auto w-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.12)]" role="img" aria-label={layout.name}>
                <defs>
                  <pattern id={hatchId} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="12" stroke="#9ca3af" strokeWidth="2" />
                  </pattern>
                </defs>
                <rect x="10" y="10" width={layout.width - 20} height={layout.height - 20} fill="#ffffff" stroke="#111827" strokeWidth="1.5" />
                {layout.features.map((feature, index) => <LayoutFeature key={`${feature.type}-${index}`} feature={feature} hatchId={hatchId} />)}
                {sortedSeats.map((seat, index) => (
                  <SeatMarker
                    key={seat.seatId}
                    seat={seat}
                    index={index}
                    rotation={getSeatRotation(seat, layout.features)}
                    onClick={handleSeatClick}
                  />
                ))}
              </svg>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <StatusKey color="bg-emerald-600" label="Available" />
          <StatusKey color="bg-amber-600" label="Pending" />
          <StatusKey color="bg-red-600" label="Occupied" />
          <StatusKey color="bg-blue-600" label="On break" />
          <StatusKey color="bg-slate-400" label="Disabled" />
        </div>
      </section>

      {selectedSeat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSeat(null); }}>
          <div className="w-full max-w-md rounded-t-md bg-white shadow-2xl sm:rounded-md" role="dialog" aria-modal="true" aria-labelledby="seat-dialog-title">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: getSeatColor(selectedSeat.status) }} />
                  <span className="text-xs font-semibold uppercase text-slate-500">{getSeatTypeLabel(selectedSeat.seatType)}</span>
                </div>
                <h2 id="seat-dialog-title" className="text-xl font-semibold text-slate-950">{selectedSeatLabel}</h2>
                <p className="mt-1 text-sm text-slate-500">{buildingName} Library · Floor {floor}</p>
              </div>
              <button type="button" onClick={() => setSelectedSeat(null)} className="ui-icon-button border-transparent" aria-label="Close seat details"><X size={20} weight="bold" /></button>
            </div>

            <div className="p-5">
              {canReserve ? (
                <>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <div className="flex gap-3">
                      <Clock size={22} weight="duotone" className="mt-0.5 shrink-0 text-[#073b66]" />
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">Five-minute entry window</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">After reserving, present the QR receipt and your university ID at the front desk.</p>
                      </div>
                    </div>
                  </div>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700">
                    <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-[#073b66]" />
                    <span>I understand this node is released if verification is not completed in five minutes.</span>
                  </label>
                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setSelectedSeat(null)} className="ui-button-secondary" disabled={reserving}>Cancel</button>
                    <button type="button" onClick={handleReserve} className="ui-button-primary" disabled={reserving || !acknowledged}>
                      <Check size={18} weight="bold" />
                      {reserving ? 'Reserving...' : `Reserve ${selectedSeatLabel}`}
                    </button>
                  </div>
                </>
              ) : selectedSeat.status === 'available' ? (
                <>
                  <p className="text-sm leading-6 text-slate-600">
                    {!user ? 'Sign in as a student to reserve this node.' : activeReservation ? 'Finish your current reservation before choosing another node.' : 'Administrator accounts can inspect nodes but cannot make student reservations.'}
                  </p>
                  <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={() => setSelectedSeat(null)} className="ui-button-secondary">Close</button>
                    {!user && <button type="button" onClick={() => navigate('/login')} className="ui-button-primary">Student sign in</button>}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold capitalize text-slate-950">Currently {selectedSeat.status.replace('_', ' ')}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{user?.role === 'student' && canUseProtectedApi && selectedSeat.status === 'occupied' ? 'If this node appears vacant in person, report it so the reservation holder can respond.' : 'This reservation node cannot be selected right now.'}</p>
                  <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={() => setSelectedSeat(null)} className="ui-button-secondary">Close</button>
                    {user?.role === 'student' && canUseProtectedApi && selectedSeat.status === 'occupied' && <button type="button" onClick={() => handleFlagSeat(selectedSeat.seatId)} className="ui-button-danger">Report vacant node</button>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function StatusKey({ color, label, value }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      <span>{label}{value !== undefined ? ` ${value}` : ''}</span>
    </span>
  );
}
