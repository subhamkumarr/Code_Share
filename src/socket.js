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

    console.log('=== Socket Connection Debug ===');
    console.log('Detected hostname:', window.location.hostname);
    console.log('Environment URL:', envUrl || '(not set)');
    console.log('Connecting to socket:', socketUrl);
    console.log('Is localhost:', isLocalhost);
    
    // Warn if no env var is set in production
    if (!isLocalhost && !envUrl) {
        console.warn('⚠️ WARNING: REACT_APP_BACKEND_URL or REACT_APP_SOCKET_URL not set in production!');
        console.warn('⚠️ Falling back to same-origin:', window.location.origin);
        console.warn('⚠️ If backend is on a different service, set REACT_APP_BACKEND_URL and rebuild.');
    }
    
    const socket = io(socketUrl, options);

    return new Promise((resolve, reject) => {
        let connectionError = null;
        const timeout = setTimeout(() => {
            socket.removeAllListeners();
            const errorMsg = connectionError 
                ? `Socket connection failed: ${connectionError.message || connectionError}`
                : `Socket connection timeout after 15s. Tried connecting to: ${socketUrl}`;
            console.error('❌ Socket connection failed:', errorMsg);
            reject(new Error(errorMsg));
        }, 15000); // Increased timeout for Render cold starts

        socket.on('connect', () => {
            console.log('✅ Socket connected:', socket.id);
            clearTimeout(timeout);
            socket.off('connect_error'); // Remove error listener on success
            resolve(socket);
        });

        socket.on('connect_error', (error) => {
            connectionError = error;
            console.error('❌ Socket connection error:', error.message || error);
            console.error('   Attempted URL:', socketUrl);
            // Socket.IO will retry automatically, so we wait for connect or timeout
            // Don't reject immediately - allow retries
        });

        // If already connected, resolve immediately
        if (socket.connected) {
            console.log('✅ Socket already connected:', socket.id);
            clearTimeout(timeout);
            socket.off('connect_error');
            resolve(socket);
        }
    });
};