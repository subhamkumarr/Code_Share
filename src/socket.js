import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempt: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
    };

    // Simplify connection logic:
    // If on localhost, assume backend is on port 5000.
    // Otherwise, assume backend is relative (same origin).
    const isLocalhost = window.location.hostname === 'localhost';
    const socketUrl = isLocalhost ? 'http://localhost:5000' : window.location.origin;

    console.log('Detected hostname:', window.location.hostname);
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