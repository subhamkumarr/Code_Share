const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? process.env.FRONTEND_URL || '*' 
            : 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    },
    allowEIO3: true
});

// Serve static files from build directory
app.use(express.static(__dirname + '/build/'));

// Catch-all handler: serve index.html for all non-API routes (must be last)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};
const roomMessagesMap = {}; // Helper to store messages per room
function getAllConnectedClients(roomId) {
    // Map
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    // Register all handlers immediately when socket connects
    console.log('Registering socket handlers for:', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        if (!roomId || !username) {
            console.error('Invalid JOIN request: missing roomId or username');
            return;
        }
        console.log(`User ${username} (${socket.id}) joining room ${roomId}`);
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        console.log(`Room ${roomId} now has ${clients.length} clients`);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });

        // Send existing messages to the joined user
        const messages = roomMessagesMap[roomId] || [];
        io.to(socket.id).emit(ACTIONS.SYNC_CHAT, {
            messages,
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        if (!roomId) {
            console.error('Invalid CODE_CHANGE request: missing roomId');
            return;
        }
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        if (!socketId) {
            console.error('Invalid SYNC_CODE request: missing socketId');
            return;
        }
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // Chat message handler - EXACT SAME PATTERN AS CODE_CHANGE
    socket.on(ACTIONS.SEND_MESSAGE, ({ roomId, username, message }) => {
        console.log(`\n=== CHAT MESSAGE RECEIVED ===`);
        console.log(`From: ${username} (${socket.id})`);
        console.log(`Message: "${message}"`);
        console.log(`Room: ${roomId}`);

        if (!roomId || !username || !message) {
            console.error('✗ Invalid SEND_MESSAGE request: missing required fields', { roomId, username, message });
            return;
        }

        // Check if socket is in the room
        const socketRooms = Array.from(socket.rooms);
        console.log(`Socket ${socket.id} is in rooms:`, socketRooms);

        // Use implicit room join if needed, or just allow the broadcast like code change
        if (!socketRooms.includes(roomId)) {
            console.log(`Note: Socket ${socket.id} not listed in room ${roomId}, but allowing message (relaxed check)`);
        }

        // Get all sockets in the room
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room) {
            console.log(`✓ Room ${roomId} has ${room.size} sockets`);
            const socketIds = Array.from(room);
            console.log(`Socket IDs in room:`, socketIds);

            // Store message
            if (!roomMessagesMap[roomId]) {
                roomMessagesMap[roomId] = [];
            }
            roomMessagesMap[roomId].push({
                username,
                message,
                timestamp: new Date().toLocaleTimeString(),
            });

            // Broadcast to all in room EXCEPT sender - EXACT SAME AS CODE_CHANGE
            socket.in(roomId).emit(ACTIONS.RECEIVE_MESSAGE, {
                username,
                message,
            });
            console.log(`✓ Message broadcasted to ${room.size - 1} other socket(s) in room ${roomId}`);
            console.log(`Broadcasted to sockets:`, socketIds.filter(id => id !== socket.id));
        } else {
            console.log(`✗ ERROR: Room ${roomId} not found!`);
            console.log(`Available rooms:`, Array.from(io.sockets.adapter.rooms.keys()));
        }
        console.log(`===========================\n`);
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });

    // Typing indicators
    socket.on(ACTIONS.TYPING_START, ({ roomId, username }) => {
        socket.in(roomId).emit(ACTIONS.TYPING_START, { username });
    });

    socket.on(ACTIONS.TYPING_STOP, ({ roomId, username }) => {
        socket.in(roomId).emit(ACTIONS.TYPING_STOP, { username });
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));