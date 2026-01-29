import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        timeout: 20000, // Increased timeout for Render
        transports: ['polling', 'websocket'], // Try polling first (more reliable on Render)
        upgrade: true,
        rememberUpgrade: false,
    };

    // Connection logic (supports Render "Static Site + Web Service" deployments):
    // Priority order:
    // 1. Runtime config (window.APP_CONFIG) - can be updated without rebuild
    // 2. Build-time env var (REACT_APP_*) - set during build
    // 3. Local dev default: http://localhost:5000
    // 4. Otherwise: same-origin (single-service deployment)
    const runtimeConfig = window.APP_CONFIG || {};
    const runtimeUrl = (runtimeConfig.SOCKET_URL || runtimeConfig.BACKEND_URL || '').trim();
    const envUrl =
        (process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_BACKEND_URL || '').trim();
    const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Use runtime config first (allows updates without rebuild), then env var, then defaults
    const socketUrl = runtimeUrl || envUrl || (isLocalhost ? 'http://localhost:5000' : window.location.origin);

    console.log('=== Socket Connection Debug ===');
    console.log('Detected hostname:', window.location.hostname);
    console.log('Runtime config URL:', runtimeUrl || '(not set)');
    console.log('Environment URL:', envUrl || '(not set)');
    console.log('Connecting to socket:', socketUrl);
    console.log('Is localhost:', isLocalhost);
    
    // Warn if no config is set in production
    if (!isLocalhost && !runtimeUrl && !envUrl) {
        console.warn('⚠️ WARNING: Backend URL not configured!');
        console.warn('⚠️ Falling back to same-origin:', window.location.origin);
        console.warn('⚠️ OPTIONS TO FIX:');
        console.warn('   1. Set REACT_APP_BACKEND_URL and rebuild (build-time)');
        console.warn('   2. Edit public/config.js and set BACKEND_URL (runtime, no rebuild needed)');
        console.warn('   3. If using Render, ensure backend is deployed as "Web Service" (not "Static Site")');
    }
    
    const socket = io(socketUrl, options);

    return new Promise((resolve, reject) => {
        let connectionError = null;
        const timeout = setTimeout(() => {
            socket.removeAllListeners();
            const errorMsg = connectionError 
                ? `Socket connection failed: ${connectionError.message || connectionError}`
                : `Socket connection timeout after 20s. Tried connecting to: ${socketUrl}`;
            console.error('❌ Socket connection failed:', errorMsg);
            console.error('💡 TROUBLESHOOTING:');
            console.error('   1. If backend is on a different URL, set REACT_APP_BACKEND_URL and rebuild');
            console.error('   2. If using Render, ensure backend is deployed as a "Web Service" (not "Static Site")');
            console.error('   3. Check that the backend service is running and accessible');
            reject(new Error(errorMsg));
        }, 20000); // Increased timeout for Render cold starts

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