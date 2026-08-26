/**
 * Server entry point — starts Express + Socket.IO and connects to Redis.
 */
import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import redis from './config/redis.js';
import { initSockets } from './sockets/index.js';
import { startReservationExpirer } from './jobs/reservationExpirer.js';

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

initSockets(io);
startReservationExpirer();

async function start() {
  try {
    await redis.connect();
    console.log('[Redis] Connected');
  } catch (err) {
    console.warn('[Redis] Could not connect on startup:', err.message);
    console.warn('[Redis] Health check will report degraded until Redis is available.');
  }

  server.listen(PORT, () => {
    console.log(`[Server] AdDU-Seats API running on http://localhost:${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
  });
}

start();

export { io };
