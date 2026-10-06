import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import AppDialog from '../components/AppDialog.jsx';
import { apiClient, API_URL, getToken } from '../api/client.js';
import {
  normalizeReservation,
  normalizeSeat,
  normalizeSeatStatus,
  seatLabelFromQrToken,
} from '../api/normalizers.js';
import { getAvailableFloors, getFloorLayout } from '../data/gisbertFloorLayouts.js';
import { getGisbertPreviewSeats } from '../data/gisbertPreviewSeats.js';
import {
  getMiguelProAreaLayout,
  getMiguelProPreviewSeats,
  MIGUEL_PRO_AREAS,
} from '../data/miguelProMap.js';
import { useAuth } from '../context/AuthContext.jsx';
import { io } from 'socket.io-client';
import { ArrowLeft, ArrowSquareOut, Clock, Minus, Plus, QrCode, Ticket, Trash, X } from '@phosphor-icons/react';

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

const MAP_THEME = {
  wall: '#1d3145',
  text: '#203347',
  room: '#fbfdff',
  shelf: '#dae5ed',
  desk: '#fffaf0',
  couch: '#edf3f7',
  curve: '#6f7f90',
  quiet: '#e8f1f8',
};

function getSeatColor(status) {
  switch (status) {
    case 'available':
      return '#047857';
    case 'occupied':
      return '#b42318';
    case 'pending':
    case 'pending_entry':
      return '#d97706';
    case 'on_break':
      return '#256d9c';
    default:
      return '#8b98a8';
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

function getPreviewSeats(building, floor, area) {
  if (building === 'gisbert') return getGisbertPreviewSeats(floor);
  if (building === 'miguel_pro') return getMiguelProPreviewSeats(floor, area);
  return [];
}

function applyCanonicalPositions(seats, building, floor, area) {
  const canonicalSeats = getPreviewSeats(building, floor, area);
  const liveByLabel = new Map(
    seats.map((seat) => [seat.label || seatLabelFromQrToken(seat.currentQrToken), seat]),
  );

  return canonicalSeats.map((canonical) => {
    const live = liveByLabel.get(canonical.label);
    return live ? normalizeSeat(live, canonical) : canonical;
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
      fill={MAP_THEME.text}
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

function LayoutFeature({ feature, hatchId, onHubClick, seatStatusByLabel }) {
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
            fill={MAP_THEME.room}
            stroke={MAP_THEME.wall}
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
            fill={MAP_THEME.shelf}
            stroke={MAP_THEME.text}
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
          fill={MAP_THEME.desk}
          stroke={MAP_THEME.wall}
          strokeWidth="1.5"
          transform={feature.rotation
            ? `rotate(${feature.rotation} ${feature.x + feature.width / 2} ${feature.y + feature.height / 2})`
            : undefined}
        />
      );
    case 'chair': {
      const chairStatus = feature.seatLabel ? seatStatusByLabel?.get(feature.seatLabel) : null;
      const chairFill = chairStatus ? getSeatColor(chairStatus) : MAP_THEME.room;
      const inset = chairStatus ? 1.25 : 0;
      return (
        <g pointerEvents="none">
          {feature.label && <title>{feature.label}</title>}
          <rect
            x={feature.x}
            y={feature.y}
            width={feature.width}
            height={feature.height}
            rx="1.5"
            fill="#ffffff"
            stroke={MAP_THEME.curve}
            strokeWidth="1.2"
          />
          <rect
            x={feature.x + inset}
            y={feature.y + inset}
            width={Math.max(feature.width - inset * 2, 0)}
            height={Math.max(feature.height - inset * 2, 0)}
            rx="1"
            fill={chairFill}
          />
        </g>
      );
    }
    case 'collabHub':
      return (
        <g
          role="button"
          tabIndex={0}
          aria-label={`${feature.label}. Open booking information.`}
          className="cursor-pointer outline-none"
          onClick={() => onHubClick?.(feature)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onHubClick?.(feature);
            }
          }}
        >
          <rect
            x={feature.x}
            y={feature.y}
            width={feature.width}
            height={feature.height}
            rx="4"
            className="fill-[#eef5fa] stroke-[#063a64] transition-colors hover:fill-[#dbeafe]"
            strokeWidth="2"
          />
          <FeatureText
            x={feature.x + feature.width / 2}
            y={feature.y + feature.height / 2}
            text={feature.label}
            fontSize={9}
          />
        </g>
      );
    case 'roundTable':
      return (
        <circle
          cx={feature.cx}
          cy={feature.cy}
          r={feature.radius}
          fill={MAP_THEME.desk}
          stroke={MAP_THEME.wall}
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
              fill={MAP_THEME.couch}
              stroke={MAP_THEME.wall}
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
            fill={MAP_THEME.couch}
            stroke={MAP_THEME.wall}
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
    case 'segmentedCouch': {
      const dividerLines = Array.from(
        { length: Math.max(0, feature.segments - 1) },
        (_, index) => index + 1,
      );
      return (
        <g>
          <rect
            x={feature.x}
            y={feature.y}
            width={feature.width}
            height={feature.height}
            rx="2"
            fill={MAP_THEME.couch}
            stroke={MAP_THEME.wall}
            strokeWidth="1.5"
          />
          {dividerLines.map((segment) => feature.orientation === 'vertical' ? (
            <line
              key={segment}
              x1={feature.x}
              x2={feature.x + feature.width}
              y1={feature.y + (feature.height * segment) / feature.segments}
              y2={feature.y + (feature.height * segment) / feature.segments}
              stroke={MAP_THEME.wall}
              strokeWidth="1"
            />
          ) : (
            <line
              key={segment}
              x1={feature.x + (feature.width * segment) / feature.segments}
              x2={feature.x + (feature.width * segment) / feature.segments}
              y1={feature.y}
              y2={feature.y + feature.height}
              stroke={MAP_THEME.wall}
              strokeWidth="1"
            />
          ))}
        </g>
      );
    }
    case 'curve':
      return (
        <path
          d={feature.d}
          fill="none"
          stroke={MAP_THEME.curve}
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
            opacity="0.32"
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
  const seatLabel = seat.label || `Seat ${index + 1}`;
  const fill = getSeatColor(seat.status);
  const isDisabled = seat.status === 'disabled';
  const isOnBreak = seat.status === 'on_break';
  const markerClass = isDisabled
    ? 'seat-marker cursor-not-allowed opacity-65'
    : 'seat-marker cursor-pointer';
  const isTableNode = seat.seatType === 'table_node';
  const renderAsTableNode = isTableNode && !seat.displayAsChair;
  const hitWidth = renderAsTableNode ? seat.hitWidth || 38 : 16;
  const hitHeight = renderAsTableNode ? seat.hitHeight || 38 : 16;

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
      aria-label={`${seatLabel}, ${getSeatTypeLabel(seat.seatType)}, ${statusLabel}`}
      aria-disabled={isDisabled}
      className={markerClass}
    >
      <title>{`${seatLabel} - ${statusLabel}`}</title>
      <rect x={-hitWidth / 2} y={-hitHeight / 2} width={hitWidth} height={hitHeight} fill="transparent" />
      {isOnBreak && !renderAsTableNode && (
        <circle
          cx="0"
          cy="0"
          r="10"
          fill="#dbeafe"
          stroke="#256d9c"
          strokeWidth="1.5"
          strokeDasharray="2.5 2"
          pointerEvents="none"
        />
      )}
      {renderAsTableNode ? (
        <rect
          className="seat-focus-ring"
          x={-hitWidth / 2}
          y={-hitHeight / 2}
          width={hitWidth}
          height={hitHeight}
          rx="4"
          fill="none"
          stroke="#063a64"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          pointerEvents="none"
        />
      ) : (
        <>
          <circle className="seat-focus-ring" cx="0" cy="0" r="8.8" fill="none" stroke="#063a64" strokeWidth="1.5" />
          <g transform={`rotate(${rotation})`}>
            {selectedSeatShape(seat.seatType, fill)}
          </g>
        </>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedHub, setSelectedHub] = useState(null);
  const [activeReservation, setActiveReservation] = useState(null);
  const [flagSeatId, setFlagSeatId] = useState(null);
  const [flagging, setFlagging] = useState(false);
  const [adminReservation, setAdminReservation] = useState(null);
  const [adminReservationLoading, setAdminReservationLoading] = useState(false);
  const [adminReservationError, setAdminReservationError] = useState('');
  const [adminVoidTarget, setAdminVoidTarget] = useState(null);
  const [voidingReservation, setVoidingReservation] = useState(false);
  const [notice, setNotice] = useState(null);
  const [zoom, setZoom] = useState(1);
  const requestedArea = searchParams.get('area');
  const miguelProArea = MIGUEL_PRO_AREAS.some((area) => area.id === requestedArea)
    ? requestedArea
    : 'main_area';

  useEffect(() => {
    const fetchActiveReservation = async () => {
      if (!user) {
        setActiveReservation(null);
        return;
      }

      try {
        const data = await apiClient('/api/reservations/me/current');
        setActiveReservation(normalizeReservation(data, { user }));
      } catch {
        setActiveReservation(null);
      }
    };

    fetchActiveReservation();

    const fetchSeats = async () => {
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({ building, floor: String(floor) });
        const data = await apiClient(`/api/seats?${query}`);
        const hydratedSeats = applyCanonicalPositions(data, building, floor, miguelProArea);
        setSeats(hydratedSeats.length ? hydratedSeats : getPreviewSeats(building, floor, miguelProArea));
      } catch (err) {
        const previewSeats = getPreviewSeats(building, floor, miguelProArea);
        setSeats(previewSeats);
        setError(previewSeats.length ? '' : err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSeats();

    const token = getToken();
    const socket = token ? io(API_URL, { auth: { token } }) : null;

    socket?.emit('join_floor', { building, floor: Number(floor) });
    socket?.on('seat_status_update', (update) => {
      setSeats((prev) =>
        prev.map((s) => s.seatId === update.seatId
          ? { ...s, status: normalizeSeatStatus(update.status) }
          : s)
      );
    });

    return () => {
      socket?.disconnect();
    };
  }, [building, floor, user, miguelProArea]);

  useEffect(() => {
    const canAdminVoid = user?.role === 'admin'
      && selectedSeat
      && ['pending', 'pending_entry', 'occupied', 'on_break'].includes(selectedSeat.status);

    setAdminReservation(null);
    setAdminReservationError('');

    if (!canAdminVoid) {
      setAdminReservationLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setAdminReservationLoading(true);

    apiClient(`/api/seats/${selectedSeat.seatId}/active-reservation`, {
      signal: controller.signal,
    })
      .then((reservation) => {
        setAdminReservation(normalizeReservation(reservation));
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setAdminReservationError(err.message || 'The active reservation could not be loaded.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAdminReservationLoading(false);
      });

    return () => controller.abort();
  }, [selectedSeat, user?.role]);

  const handleSeatClick = (seat) => {
    if (seat.status === 'disabled') return;
    setSelectedSeat(seat);
  };

  const handleOpenActiveReservation = () => {
    if (!activeReservation) return;
    navigate('/receipt', {
      state: {
        reservation: activeReservation,
        qrToken: activeReservation.qrToken || activeReservation.seat?.currentQrToken || null,
      }
    });
  };

  const handleFlagSeat = async (seatId) => {
    if (activeReservation?.seat?.seatId === seatId) {
      setFlagSeatId(null);
      setNotice({
        tone: 'warning',
        title: 'This is your reserved seat',
        description: 'You cannot report your own reservation as a ghost seat.',
      });
      return;
    }

    setFlagging(true);
    try {
      await apiClient(`/api/seats/${seatId}/flag`, { method: 'POST' });
      setFlagSeatId(null);
      setSelectedSeat(null);
      setNotice({
        tone: 'success',
        title: 'Ghost seat reported',
        description: 'The reservation holder and front desk were notified. The holder must re-verify at the physical QR.',
      });
    } catch (err) {
      setFlagSeatId(null);
      setNotice({ tone: 'danger', title: 'Report failed', description: err.message });
    } finally {
      setFlagging(false);
    }
  };

  const handleAdminVoid = async () => {
    if (!adminVoidTarget || voidingReservation) return;

    setVoidingReservation(true);
    try {
      await apiClient(`/api/reservations/${adminVoidTarget.reservationId}/void`, {
        method: 'POST',
      });
      setSeats((currentSeats) => currentSeats.map((seat) => (
        seat.seatId === adminVoidTarget.seatId ? { ...seat, status: 'available' } : seat
      )));
      setSelectedSeat(null);
      setAdminReservation(null);
      setAdminVoidTarget(null);
      setNotice({
        tone: 'success',
        title: 'Reservation voided',
        description: `${adminVoidTarget.seatLabel} is available again.`,
      });
    } catch (err) {
      setAdminVoidTarget(null);
      setNotice({
        tone: 'danger',
        title: 'Void failed',
        description: err.message || 'The reservation could not be voided.',
      });
    } finally {
      setVoidingReservation(false);
    }
  };

  const layout = building === 'miguel_pro'
    ? getMiguelProAreaLayout(miguelProArea)
    : getFloorLayout(building, floor) || DEFAULT_LAYOUT;
  const availableFloors = getAvailableFloors(building);
  const hatchId = `map-hatch-${building}-${floor}`;
  const visibleSeats = seats.filter((seat) => !(
    building === 'gisbert'
    && Number(floor) === 1
    && seat.seatType === 'table_node'
  ));
  const seatStatusByLabel = new Map(visibleSeats.map((seat) => [seat.label, seat.status]));
  const sortedSeats = [...visibleSeats].sort((a, b) => (a.posY - b.posY) || (a.posX - b.posX));
  const selectedSeatNumber = selectedSeat
    ? sortedSeats.findIndex((seat) => seat.seatId === selectedSeat.seatId) + 1
    : 0;
  const buildingCode = building === 'miguel_pro' ? 'M' : 'G';
  const selectedSeatLabel = selectedSeat?.label || `${buildingCode}${floor}-S${String(selectedSeatNumber).padStart(3, '0')}`;
  const selectedSeatIsOwnReservation = Boolean(
    selectedSeat?.seatId && activeReservation?.seat?.seatId === selectedSeat.seatId,
  );
  const availableCount = sortedSeats.filter((seat) => seat.status === 'available').length;
  const pendingCount = sortedSeats.filter((seat) => ['pending', 'pending_entry'].includes(seat.status)).length;
  const occupiedCount = sortedSeats.filter((seat) => seat.status === 'occupied').length;
  const breakCount = sortedSeats.filter((seat) => seat.status === 'on_break').length;
  const buildingName = building.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const activeAreaLabel = MIGUEL_PRO_AREAS.find((area) => area.id === miguelProArea)?.label;
  const locationLabel = building === 'miguel_pro'
    ? `${buildingName} - ${activeAreaLabel}`
    : `${buildingName} Library - Floor ${floor}`;

  const setMapZoom = (nextZoom) => setZoom(Math.min(1.8, Math.max(0.8, nextZoom)));

  return (
    <Layout>
      <section className="ui-surface-band mb-5 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end">
        <div>
          <button type="button" onClick={() => navigate('/')} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#063a64] hover:text-[#032946]">
            <ArrowLeft size={17} weight="bold" />
            All locations
          </button>
          <h1 className="ui-page-title">{locationLabel}</h1>
          <p className="ui-muted mt-2">Select an available seat to begin a reservation.</p>
        </div>
        {activeReservation && (
          <button type="button" onClick={handleOpenActiveReservation} className="ui-button-secondary self-start border-amber-300 bg-amber-50 text-amber-900">
            <Ticket size={18} weight="duotone" />
            Open reservation
          </button>
        )}
      </section>

      <section className="ui-panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white/95 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 lg:pb-0" aria-label={building === 'miguel_pro' ? 'Choose room' : 'Choose floor'}>
            <span className="mr-1 shrink-0 text-xs font-semibold uppercase text-slate-500">{building === 'miguel_pro' ? 'Room' : 'Floor'}</span>
            {building === 'miguel_pro' ? MIGUEL_PRO_AREAS.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => {
                  setSearchParams({ area: area.id });
                  setSelectedSeat(null);
                  setSelectedHub(null);
                  setZoom(1);
                }}
                aria-current={miguelProArea === area.id ? 'page' : undefined}
                className={`min-h-10 shrink-0 rounded-[8px] border px-4 text-sm font-semibold ${miguelProArea === area.id ? 'border-[#063a64] bg-[#063a64] text-white shadow-[0_10px_24px_rgba(6,58,100,0.18)]' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'}`}
              >
                {area.label}
              </button>
            )) : availableFloors.map((floorNumber) => (
              <button
                key={floorNumber}
                type="button"
                onClick={() => navigate(`/map/${building}/${floorNumber}`)}
                aria-current={Number(floor) === floorNumber ? 'page' : undefined}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border text-sm font-semibold ${Number(floor) === floorNumber ? 'border-[#063a64] bg-[#063a64] text-white shadow-[0_10px_24px_rgba(6,58,100,0.18)]' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'}`}
              >
                {floorNumber}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
            <StatusKey color="bg-emerald-600" label="Available" value={availableCount} />
            <StatusKey color="bg-amber-600" label="Pending" value={pendingCount} />
            <StatusKey color="bg-red-600" label="Occupied" value={occupiedCount} />
            <StatusKey color="bg-blue-600" label="On break" value={breakCount} />
          </div>
        </div>

        {activeReservation ? (
          <div className="flex flex-col justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center">
            <span>A reservation is already in progress. Finish or cancel it before choosing another seat.</span>
            {activeReservation && <button type="button" onClick={handleOpenActiveReservation} className="self-start font-semibold underline decoration-2 underline-offset-4">View details</button>}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-[#f5f9fc] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{layout.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{availableCount} of {sortedSeats.length} seats available</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMapZoom(zoom - 0.2)} disabled={zoom <= 0.8} className="ui-icon-button" aria-label="Zoom out" title="Zoom out"><Minus size={18} weight="bold" /></button>
            <span className="w-12 text-center text-xs font-semibold text-slate-600" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setMapZoom(zoom + 0.2)} disabled={zoom >= 1.8} className="ui-icon-button" aria-label="Zoom in" title="Zoom in"><Plus size={18} weight="bold" /></button>
          </div>
        </div>

        {loading ? (
          <div className="min-h-[480px] bg-[#e2ebf2] p-5">
            <div className="mx-auto max-w-5xl rounded-[8px] border border-slate-300 bg-white p-4 shadow-[0_20px_56px_rgba(14,35,56,0.12)]">
              <div className="loading-skeleton h-8 w-52 rounded-[6px]" />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="loading-skeleton h-44 rounded-[8px]" />
                <div className="loading-skeleton h-44 rounded-[8px] sm:col-span-2" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="loading-skeleton h-24 rounded-[8px]" />
                <div className="loading-skeleton h-24 rounded-[8px]" />
                <div className="loading-skeleton h-24 rounded-[8px]" />
                <div className="loading-skeleton h-24 rounded-[8px]" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="ui-alert-danger m-4">{error}</div>
        ) : (
          <div className="max-h-[72vh] min-h-[440px] overflow-auto bg-[#dfe8ef] p-3 sm:p-5">
            <div className="mx-auto origin-top" style={{ width: `${zoom * 100}%`, minWidth: zoom >= 1 ? '680px' : '560px' }}>
              <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="map-paper block h-auto w-full" role="group" aria-label={`${layout.name} interactive map`}>
                <defs>
                  <pattern id={hatchId} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="12" stroke="#9ca3af" strokeWidth="2" />
                  </pattern>
                </defs>
                <rect x="10" y="10" width={layout.width - 20} height={layout.height - 20} fill="#fbfdff" stroke="#1d3145" strokeWidth="1.5" />
                {layout.features.map((feature, index) => (
                  <LayoutFeature
                    key={`${feature.type}-${index}`}
                    feature={feature}
                    hatchId={hatchId}
                    onHubClick={setSelectedHub}
                    seatStatusByLabel={seatStatusByLabel}
                  />
                ))}
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

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-600">
          <StatusKey color="bg-emerald-600" label="Available" />
          <StatusKey color="bg-amber-600" label="Pending" />
          <StatusKey color="bg-red-600" label="Occupied" />
          <StatusKey color="bg-blue-600" label="On break" />
          <StatusKey color="bg-slate-400" label="Disabled" />
        </div>
      </section>

      {selectedHub && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedHub(null); }}>
          <div className="w-full max-w-md rounded-t-[8px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.34)] sm:rounded-[8px]" role="dialog" aria-modal="true" aria-labelledby="hub-dialog-title">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#063a64]">Miguel Pro collaboration room</p>
                <h2 id="hub-dialog-title" className="mt-1 text-xl font-semibold text-slate-950">{selectedHub.label}</h2>
              </div>
              <button type="button" onClick={() => setSelectedHub(null)} className="ui-icon-button border-transparent" aria-label="Close collaboration hub details"><X size={20} weight="bold" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm leading-6 text-slate-600">Collab Hub schedules and reservations are managed through the official AdDU Library booking page.</p>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setSelectedHub(null)} className="ui-button-secondary">Close</button>
                <a href="https://library.addu.edu.ph/hub/" target="_blank" rel="noreferrer" className="ui-button-primary">
                  Book this hub
                  <ArrowSquareOut size={18} weight="bold" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSeat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSeat(null); }}>
          <div className="w-full max-w-md rounded-t-[8px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.34)] sm:rounded-[8px]" role="dialog" aria-modal="true" aria-labelledby="seat-dialog-title">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: getSeatColor(selectedSeat.status) }} />
                  <span className="text-xs font-semibold uppercase text-slate-500">{getSeatTypeLabel(selectedSeat.seatType)}</span>
                </div>
                <h2 id="seat-dialog-title" className="text-xl font-semibold text-slate-950">{selectedSeatLabel}</h2>
                <p className="mt-1 text-sm text-slate-500">{locationLabel}</p>
              </div>
              <button type="button" onClick={() => setSelectedSeat(null)} className="ui-icon-button border-transparent" aria-label="Close seat details"><X size={20} weight="bold" /></button>
            </div>

            <div className="p-5">
              {selectedSeat.status === 'available' ? (
                <>
                  <div className="ui-soft-panel p-4">
                    <div className="flex gap-3">
                      <QrCode size={24} weight="duotone" className="mt-0.5 shrink-0 text-[#063a64]" />
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">Scan the physical QR to reserve</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">Please scan the QR code attached to {selectedSeatLabel} at {locationLabel}. Selecting a seat on this map only shows its availability.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    <Clock size={21} weight="duotone" className="mt-0.5 shrink-0" />
                    <span>After the physical scan and reservation, you have five minutes to present the digital receipt and your name at the front desk.</span>
                  </div>
                  {activeReservation && (
                    <p className="mt-4 text-sm font-semibold text-red-700">Finish or cancel your current reservation before scanning another seat.</p>
                  )}
                  <div className="mt-6 flex justify-end">
                    <button type="button" onClick={() => setSelectedSeat(null)} className="ui-button-secondary">Close</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold capitalize text-slate-950">Currently {selectedSeat.status.replace('_', ' ')}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {user?.role === 'admin'
                      ? 'Review the active reservation before releasing this seat.'
                      : selectedSeatIsOwnReservation
                      ? 'This is your active reservation. You cannot report your own seat.'
                      : user?.role === 'student' && selectedSeat.status === 'occupied'
                        ? 'If this seat appears vacant in person, report it so the reservation holder can respond.'
                        : 'This seat cannot be selected right now.'}
                  </p>
                  {user?.role === 'admin' && ['pending', 'pending_entry', 'occupied', 'on_break'].includes(selectedSeat.status) && (
                    <div className="ui-soft-panel mt-4 p-4">
                      <p className="ui-label">Active reservation</p>
                      {adminReservationLoading ? (
                        <div className="mt-3 space-y-2" aria-label="Loading active reservation">
                          <div className="loading-skeleton h-4 w-2/3 rounded" />
                          <div className="loading-skeleton h-4 w-1/2 rounded" />
                        </div>
                      ) : adminReservationError ? (
                        <p className="mt-2 text-sm leading-6 text-red-700">{adminReservationError}</p>
                      ) : adminReservation ? (
                        <div className="mt-2 text-sm leading-6 text-slate-700">
                          <p className="font-semibold text-slate-950">{adminReservation.user?.name || 'Unknown student'}</p>
                          <p>{adminReservation.user?.adduIdLast4 ? `ID ending ${adminReservation.user.adduIdLast4}` : 'Student ID suffix unavailable'}</p>
                          <p className="capitalize">Reservation status: {adminReservation.status.replace('_', ' ')}</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={() => setSelectedSeat(null)} className="ui-button-secondary">Close</button>
                    {user?.role === 'student' && selectedSeat.status === 'occupied' && !selectedSeatIsOwnReservation && <button type="button" onClick={() => setFlagSeatId(selectedSeat.seatId)} className="ui-button-danger">Report ghost seat</button>}
                    {user?.role === 'admin' && adminReservation && (
                      <button
                        type="button"
                        onClick={() => setAdminVoidTarget({
                          reservationId: adminReservation.reservationId,
                          seatId: selectedSeat.seatId,
                          seatLabel: selectedSeatLabel,
                          studentName: adminReservation.user?.name,
                        })}
                        className="ui-button-danger bg-red-700 text-white hover:bg-red-800"
                      >
                        <Trash size={18} weight="bold" />
                        Void reservation
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <AppDialog
        open={Boolean(flagSeatId)}
        tone="warning"
        title="Report a possible ghost seat?"
        description={`Report ${selectedSeatLabel} as vacant? The reservation holder and front desk will be notified and asked to verify the physical QR.`}
        confirmLabel="Submit report"
        cancelLabel="Go back"
        busy={flagging}
        onConfirm={() => handleFlagSeat(flagSeatId)}
        onClose={() => setFlagSeatId(null)}
      />
      <AppDialog
        open={Boolean(adminVoidTarget)}
        tone="danger"
        title="Void this reservation?"
        description={adminVoidTarget ? `This will end ${adminVoidTarget.studentName || 'the student'}'s reservation for ${adminVoidTarget.seatLabel} and make the seat available again.` : ''}
        confirmLabel="Void reservation"
        cancelLabel="Keep reservation"
        busy={voidingReservation}
        dismissible={!voidingReservation}
        onConfirm={handleAdminVoid}
        onClose={() => setAdminVoidTarget(null)}
      />
      <AppDialog
        open={Boolean(notice)}
        tone={notice?.tone}
        title={notice?.title}
        description={notice?.description}
        confirmLabel="Close"
        onClose={() => setNotice(null)}
      />
    </Layout>
  );
}

function StatusKey({ color, label, value }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`h-2.5 w-2.5 rounded-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] ${color}`} />
      <span>{label}{value !== undefined ? ` ${value}` : ''}</span>
    </span>
  );
}
