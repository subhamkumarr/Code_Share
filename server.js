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

// Parse JSON bodies for API routes
app.use(express.json());

// Enable CORS for API routes
app.use((req, res, next) => {
    const origin = process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : 'http://localhost:3000';

    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Code execution endpoint
app.post('/api/execute', async (req, res) => {
    const { code, language, stdin } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required' });
    }

    // Local C++ Execution
    if (language === 'cpp' || language === 'c++') {
        const fs = require('fs');
        const { exec } = require('child_process');
        const path = require('path');
        const os = require('os');

        // Use a temp directory for safe file handling
        const tempDir = os.tmpdir();
        const jobId = require('uuid').v4(); // Generate unique ID for this run
        const sourceFile = path.join(tempDir, `${jobId}.cpp`);
        const outputFile = path.join(tempDir, `${jobId}.exe`); // Windows exe

        try {
            // 1. Write code to file
            await fs.promises.writeFile(sourceFile, code);

            // 2. Compile
            // g++ source -o output
            exec(`g++ "${sourceFile}" -o "${outputFile}"`, (compileError, stdout, stderr) => {
                if (compileError) {
                    // Cleanup source
                    fs.unlink(sourceFile, () => { });
                    return res.json({
                        stdout: '',
                        stderr: stderr || compileError.message,
                        exitCode: 1
                    });
                }

                // 3. Execute
                // Verify output file exists
                if (!fs.existsSync(outputFile)) {
                    return res.status(500).json({ error: 'Compilation failed to generate executable' });
                }

                // Run the executable
                const child = exec(`"${outputFile}"`, { timeout: 5000 }, (runError, runStdout, runStderr) => {
                    // Cleanup
                    fs.unlink(sourceFile, () => { });
                    fs.unlink(outputFile, () => { });

                    if (runError && runError.killed) {
                        return res.json({ stdout: '', stderr: 'Execution timed out', exitCode: 124 });
                    }

                    res.json({
                        stdout: runStdout,
                        stderr: runStderr || (runError ? runError.message : ''),
                        exitCode: runError ? (runError.code || 1) : 0
                    });
                });

                // Handle stdin
                if (stdin) {
                    child.stdin.write(stdin);
                    child.stdin.end();
                }
            });
        } catch (err) {
            console.error('Local execution error:', err);
            res.status(500).json({ error: 'Internal server error during execution' });
        }
        return;
    }

    // Fallback to Piston for other languages (if any added later) or return error
    res.status(400).json({ error: 'Only JavaScript (client-side) and C++ (server-side) are currently supported.' });
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