import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        transports: ['websocket', 'polling'],
    };

    // Connection logic (supports Render "Static Site + Web Service" deployments):
    // - Prefer explicit env var (CRA exposes REACT_APP_* at build time)
    // - Local dev default: http://localhost:5000
    // - Otherwise: same-origin (single-service deployment)
    const envUrl =
        (process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_BACKEND_URL || '').trim();
    const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const socketUrl = envUrl || (isLocalhost ? 'http://localhost:5000' : window.location.origin);

    console.log('Detected hostname:', window.location.hostname);
    console.log('Connecting to socket:', socketUrl);
    const socket = io(socketUrl, options);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.removeAllListeners();
            reject(new Error('Socket connection timeout'));
        }, 15000); // Increased timeout for Render cold starts

        socket.on('connect', () => {
            console.log('Socket connected:', socket.id);
            clearTimeout(timeout);
            socket.off('connect_error'); // Remove error listener on success
            resolve(socket);
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            // Socket.IO will retry automatically, so we wait for connect or timeout
            // Don't reject immediately - allow retries
        });

        // If already connected, resolve immediately
        if (socket.connected) {
            clearTimeout(timeout);
            socket.off('connect_error');
            resolve(socket);
        }
    });
};