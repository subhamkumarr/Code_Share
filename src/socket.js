import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempt: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
    };

    // In production, explicitly use relative path/origin to ensure we connect to the served backend
    // This overrides any accidental localhost .env variables that might have been baked in
    const isProduction = process.env.NODE_ENV === 'production';
    const socketUrl = isProduction ? window.location.origin : (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');

    console.log('Environment:', process.env.NODE_ENV);
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