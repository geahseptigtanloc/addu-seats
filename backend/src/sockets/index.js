/**
 * Socket.IO initialization.
 * Phase 1: server listens and accepts connections; no event handlers yet.
 * Phase 2+: broadcast seat status changes to connected clients.
 */
export function initSockets(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });

    // Phase 2: clients will join rooms per building/floor
    // Phase 3: emit 'seat:updated' when reservation status changes
  });

  return io;
}
