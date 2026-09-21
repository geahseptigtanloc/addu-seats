/**
 * Socket.IO client hook — connects on mount, disconnects on unmount.
 * Phase 1: connection only; no event listeners yet.
 * Phase 2+: listen for 'seat:updated' broadcasts.
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api/client.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    socketRef.current = io(SOCKET_URL, { auth: { token }, autoConnect: true });

    socketRef.current.on('connect', () => {
      console.log('[Socket.IO] Connected:', socketRef.current.id);
    });

    // Phase 2: socketRef.current.on('seat:updated', handler)

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return socketRef;
}
