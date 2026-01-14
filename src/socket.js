import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempt: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
    };
    transports: ['websocket'],
    };
// Fallback to localhost:5000 if not set and we are on localhost, otherwise use current origin (for prod)
const socketUrl = process.env.REACT_APP_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);
console.log('Connecting to socket:', socketUrl);
const socket = io(socketUrl, options);

return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
    }, 10000);

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        clearTimeout(timeout);
        resolve(socket);
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        clearTimeout(timeout);
        // Still resolve the socket so the app can try to reconnect
        resolve(socket);
    });

    // If already connected, resolve immediately
    if (socket.connected) {
        clearTimeout(timeout);
        resolve(socket);
    }
});
};