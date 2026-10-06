import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type DefaultEventsMap } from 'socket.io';
import { z } from 'zod';
import type { SeatStatus } from '@prisma/client';
import { corsOrigins } from './env';
import { logger } from './logger';
import { verifyToken } from '../utils/jwt';

/**
 * Floor rooms carry deltas only.
 * clients load the initial full state via
 * GET /seats, then join a room here to receive incremental updates.
 */
interface ClientToServerEvents {
  join_floor: (payload: { building: string; floor: number }) => void;
  leave_floor: () => void;
}

export type SeatFlagResolution = 'reverified' | 'evicted' | 'voided' | 'checked_out';

// Sent to the reservation holder. Never includes who reported the seat.
interface SeatFlaggedPayload {
  flagId: string;
  seatId: string;
  seatLabel: string;
  building: string;
  floor: number;
  reservationId: string;
  windowSeconds: number;
  flaggedAt: string;
  expiresAt: string;
  message: string;
}

interface SeatFlaggedAdminPayload {
  flagId: string;
  seatId: string;
  seatLabel: string;
  reservationId: string;
  building: string;
  floor: number;
  studentName: string;
  studentIdLast4: string | null;
  windowSeconds: number;
  expiresAt: string;
  reportedAt: string;
}

interface SeatFlagResolvedPayload {
  flagId: string;
  reservationId: string;
  resolution: SeatFlagResolution;
  resolvedAt: string;
}

interface ReservationPendingAdminPayload {
  reservationId: string;
  seatId: string;
  seatLabel: string;
  building: string;
  floor: number;
  studentName: string;
  studentIdLast4: string | null;
  createdAt: string;
  expiresAt: string;
}

interface ReservationPendingResolvedPayload {
  reservationId: string;
}

interface ReservationEvictedPayload {
  reservationId: string;
  seatId: string;
  reason: 'flag_expired';
  message: string;
  endedAt: string;
}

interface ServerToClientEvents {
  joined_floor: (payload: { room: string }) => void;
  seat_status_update: (payload: { seatId: string; status: SeatStatus }) => void;
  seat_flagged: (payload: SeatFlaggedPayload) => void;
  seat_flagged_admin_notice: (payload: SeatFlaggedAdminPayload) => void;
  seat_flag_resolved_admin_notice: (payload: SeatFlagResolvedPayload) => void;
  reservation_pending_admin_notice: (payload: ReservationPendingAdminPayload) => void;
  reservation_pending_resolved_admin_notice: (payload: ReservationPendingResolvedPayload) => void;
  reservation_evicted: (payload: ReservationEvictedPayload) => void;
  socket_error: (payload: { message: string }) => void;
}

interface SocketData {
  userId: string;
  role: 'STUDENT' | 'ADMIN';
  currentFloorRoom?: string;
}

type AppSocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

let io: AppSocketServer | undefined;

const joinFloorSchema = z.object({
  building: z.string().min(1),
  floor: z.number().int(),
});

export function getFloorRoom(building: string, floor: number): string {
  return `floor:${building}-${floor}`;
}

// Personal room, auto-joined on connect
// Lets services notify one specific user directly (e.g. seat_flagged) instead of a whole floor.
export function getUserRoom(userId: string): string {
  return `user:${userId}`;
}

// Shared room for every connected admin.
// For "front desk passively notified of the flag"
// feature, not requiring any action.
const ADMIN_ROOM = 'role:admin';

/**
 * Call once at startup (from server.ts), passing the raw http.Server,
 * Socket.IO needs to attach to that directly, not to the Express app.
 */
export function initSocket(httpServer: HttpServer): AppSocketServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigins,
    },
  });

  // JWT handshake auth
  // the client connects with `auth: { token }` instead
  // of a cookie, matching the bearer-token approach used for REST (see
  // architecture doc: JWT chosen partly because it makes the Socket.IO
  // handshake simpler than cookie-based session auth would be).
  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth['token'];

    if (typeof token !== 'string' || token.length === 0) {
      logger.warn({ socketId: socket.id }, 'Socket auth rejected: token missing');
      next(new Error('Authentication token missing'));
      return;
    }

    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch (err) {
      logger.warn({ socketId: socket.id, err }, 'Socket auth rejected: invalid token');
      next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info({ userId: socket.data.userId }, 'Socket connected');
    void socket.join(getUserRoom(socket.data.userId));

    if (socket.data.role === 'ADMIN') {
      void socket.join(ADMIN_ROOM);
    }

    // A socket only ever watches one floor at a time. Joining a new one
    socket.on('join_floor', (payload) => {
      const parsed = joinFloorSchema.safeParse(payload);

      if (!parsed.success) {
        socket.emit('socket_error', { message: 'Invalid join_floor payload' });
        return;
      }

      if (socket.data.currentFloorRoom) {
        void socket.leave(socket.data.currentFloorRoom);
      }

      const room = getFloorRoom(parsed.data.building, parsed.data.floor);
      void socket.join(room);
      socket.data.currentFloorRoom = room;
      socket.emit('joined_floor', { room });
    });

    socket.on('leave_floor', () => {
      if (socket.data.currentFloorRoom) {
        void socket.leave(socket.data.currentFloorRoom);
        socket.data.currentFloorRoom = undefined;
      }
    });

    // Socket.IO removes a disconnected socket from all its rooms automatically.
    socket.on('disconnect', () => {
      logger.info({ userId: socket.data.userId }, 'Socket disconnected');
    });
  });

  return io;
}

/**
 * Services (and background jobs) call this to push a seat
 * status change to everyone currently viewing that floor.
 */
export function broadcastSeatStatusUpdate(
  building: string,
  floor: number,
  payload: { seatId: string; status: SeatStatus },
): void {
  getIO().to(getFloorRoom(building, floor)).emit('seat_status_update', payload);
}

// Targets only the reservation holder, not the whole floor, a no-op if
// they aren't currently connected (Socket.IO just finds an empty room).
export function notifySeatFlagged(userId: string, payload: SeatFlaggedPayload): void {
  getIO().to(getUserRoom(userId)).emit('seat_flagged', payload);
}

// Every connected admin sees the report and can open the protected
// confirmation action from the dashboard.
export function notifyAdminsSeatFlagged(payload: SeatFlaggedAdminPayload): void {
  getIO().to(ADMIN_ROOM).emit('seat_flagged_admin_notice', payload);
}

export function notifyAdminsSeatFlagResolved(payload: SeatFlagResolvedPayload): void {
  getIO().to(ADMIN_ROOM).emit('seat_flag_resolved_admin_notice', payload);
}

export function notifyAdminsReservationPending(payload: ReservationPendingAdminPayload): void {
  getIO().to(ADMIN_ROOM).emit('reservation_pending_admin_notice', payload);
}

export function notifyAdminsReservationPendingResolved(
  payload: ReservationPendingResolvedPayload,
): void {
  getIO().to(ADMIN_ROOM).emit('reservation_pending_resolved_admin_notice', payload);
}

// The holder's reservation was ended by the flag deadline, so their open
// page can leave the "active reservation" state without a refresh.
export function notifyReservationEvicted(userId: string, payload: ReservationEvictedPayload): void {
  getIO().to(getUserRoom(userId)).emit('reservation_evicted', payload);
}

export function getIO(): AppSocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized, call initSocket() before getIO()');
  }
  return io;
}
