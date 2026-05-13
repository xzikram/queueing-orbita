import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== 'undefined' ? `http://${window.location.hostname}:3001` : 'http://localhost:3001');

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/api/socket.io/',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export function joinDisplay(displayCode: string) {
  const s = getSocket();
  s.emit('joinDisplay', displayCode);
}

export function leaveDisplay(displayCode: string) {
  const s = getSocket();
  s.emit('leaveDisplay', displayCode);
}
