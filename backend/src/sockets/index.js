/**
 * Socket.IO initialization.
 * Phase 2: broadcast seat status changes to connected clients per floor namespace.
 */
import { verifyToken } from '../config/jwt.js';

export function initSockets(io) {
  const floorNamespace = io.of(/^\/floor\/.+$/);

  floorNamespace.on('connection', (socket) => {
    const namespaceName = socket.nsp.name;
    console.log(`[Socket.IO] Client connected to namespace: ${namespaceName}, id: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected from namespace: ${namespaceName}, id: ${socket.id}`);
    });
  });

  const userNamespace = io.of('/user');
  userNamespace.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.disconnect();
      return;
    }

    try {
      const payload = verifyToken(token);
      socket.join(`user:${payload.userId}`);
      console.log(`[Socket.IO] User ${payload.userId} connected to /user`);

      if (['staff', 'admin'].includes(payload.role)) {
        socket.join('staff-room');
        console.log(`[Socket.IO] User ${payload.userId} joined staff-room`);
      }
    } catch {
      socket.disconnect();
    }
  });

  return io;
}
