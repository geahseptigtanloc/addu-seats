import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type DefaultEventsMap } from 'socket.io';
import { env } from './env';
import { logger } from './logger';
import { verifyToken } from '../utils/jwt';

/**
 * Additional properties attached to each socket instance after handshake
 * auth succeeds. Typing this is what makes
 * `socket.data.userId` type-safe everywhere instead of `any`.
 */
interface SocketData {
  userId: string;
  role: 'STUDENT' | 'ADMIN';
}

type AppSocketServer = SocketIOServer<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

let io: AppSocketServer | undefined;

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

    socket.on('disconnect', () => {
      logger.info({ userId: socket.data.userId }, 'Socket disconnected');
    });
  });

  return io;
}

/**
 * Services (and background jobs) call this to emit seat-status
 * updates into a floor room, e.g. getIO().to('floor/main-2').emit(...).
 */
export function getIO(): AppSocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized, call initSocket() before getIO()');
  }
  return io;
}
