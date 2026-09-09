import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type DefaultEventsMap } from 'socket.io';
import { z } from 'zod';
import type { SeatStatus } from '@prisma/client';
import { env } from './env';
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

interface ServerToClientEvents {
  joined_floor: (payload: { room: string }) => void;
  seat_status_update: (payload: { seatId: string; status: SeatStatus }) => void;
  seat_flagged: (payload: { seatId: string; windowSeconds: number }) => void;
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

/**
 * Call once at startup (from server.ts), passing the raw http.Server,
 * Socket.IO needs to attach to that directly, not to the Express app.
 */
export function initSocket(httpServer: HttpServer): AppSocketServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
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

    // A socket only ever watches one floor at a time. Joining a new one
    // leaves the previous, so a student switching floors on the map
    // doesn't keep receiving updates for a floor they're no longer viewing.
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
export function notifySeatFlagged(
  userId: string,
  payload: { seatId: string; windowSeconds: number },
): void {
  getIO().to(getUserRoom(userId)).emit('seat_flagged', payload);
}

export function getIO(): AppSocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized, call initSocket() before getIO()');
  }
  return io;
}
