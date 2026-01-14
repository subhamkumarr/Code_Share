import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempt: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
    };
    const socketUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
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
        if(socket.connected) {
            clearTimeout(timeout);
            resolve(socket);
        }
    });
};