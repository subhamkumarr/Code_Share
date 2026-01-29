const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Allow all localhost origins for development
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3002',
                process.env.FRONTEND_URL
            ].filter(Boolean); // Remove undefined values
            
            const isProduction = process.env.NODE_ENV === 'production';
            const isSameOrigin = !origin; // Socket.IO may not send origin for same-origin
            const isLocalhost = origin && origin.startsWith('http://localhost:');
            const isRenderOrigin = origin && (origin.includes('.onrender.com') || origin.includes('.render.com'));
            
            // Allow conditions:
            // 1. Same-origin (no origin header)
            // 2. Localhost in any environment
            // 3. Explicitly allowed origins
            // 4. Render origins in production (if FRONTEND_URL not set, be permissive)
            // 5. Any origin in production if FRONTEND_URL is not configured (fallback)
            const shouldAllow = 
                !origin || 
                isSameOrigin || 
                isLocalhost || 
                allowedOrigins.includes(origin) ||
                (isProduction && (isRenderOrigin || !process.env.FRONTEND_URL));
            
            if (shouldAllow) {
                console.log('✅ CORS allowed for origin:', origin || '(same-origin)');
                callback(null, true);
            } else {
                console.warn('❌ CORS blocked for origin:', origin);
                console.warn('   Allowed origins:', allowedOrigins);
                console.warn('   FRONTEND_URL env var:', process.env.FRONTEND_URL || '(not set)');
                console.warn('   💡 TIP: Set FRONTEND_URL env var on backend service to allow this origin');
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
    allowEIO3: true
});

// Parse JSON bodies for API routes
app.use(express.json());

// Enable CORS for API routes
app.use((req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const requestOrigin = req.headers.origin;
    const isLocalhost = requestOrigin && requestOrigin.startsWith('http://localhost:');
    const isRenderOrigin = requestOrigin && (requestOrigin.includes('.onrender.com') || requestOrigin.includes('.render.com'));
    
    // Determine allowed origin
    let allowedOrigin = '*';
    if (isProduction) {
        // In production:
        // 1. Prefer FRONTEND_URL if set
        // 2. Allow Render origins if FRONTEND_URL not set (permissive fallback)
        // 3. Allow same-origin requests
        if (process.env.FRONTEND_URL) {
            allowedOrigin = process.env.FRONTEND_URL;
        } else if (isRenderOrigin) {
            // Allow any Render origin if FRONTEND_URL not configured
            allowedOrigin = requestOrigin;
        } else if (requestOrigin) {
            allowedOrigin = requestOrigin;
        } else {
            allowedOrigin = '*';
        }
    } else {
        // In dev, allow localhost origins
        allowedOrigin = isLocalhost ? requestOrigin : 'http://localhost:3000';
    }

    res.header('Access-Control-Allow-Origin', allowedOrigin);
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

app.post('/api/problem', async (req, res) => {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: 'Slug is required' });

    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://leetcode.com'
            },
            body: JSON.stringify({
                query: `
                    query getQuestionDetail($titleSlug: String!) {
                        question(titleSlug: $titleSlug) {
                            questionId
                            title
                            content
                            difficulty
                        }
                    }
                `,
                variables: { titleSlug: slug }
            })
        });



        const data = await response.json();

        // Console log for debugging
        if (data.errors) {
            console.error('LeetCode API returned errors:', data.errors);
            return res.status(400).json({ error: 'Problem not found or LeetCode API error', details: data.errors });
        }

        if (!data.data || !data.data.question) {
            console.error('LeetCode API returned no data:', data);
            return res.status(404).json({ error: 'Problem content not found. Check the name spelling.' });
        }

        res.json(data.data.question);
    } catch (err) {
        console.error('LeetCode API Network Error:', err);
        res.status(500).json({ error: 'Internal server error while fetching problem.' });
    }
});

// Serve static files from build directory
app.use(express.static(__dirname + '/build/'));

// Catch-all handler: serve index.html for all non-API routes (must be last)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};
const roomMessagesMap = {}; // Helper to store messages per room
const roomFilesMap = {}; // Helper to store files per room

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

        // Send existing messages and files to the joined user
        const messages = roomMessagesMap[roomId] || [];
        const files = roomFilesMap[roomId] || [];

        // Initialize default file if room is empty
        if (files.length === 0) {
            files.push({
                id: 'main-js',
                name: 'main.js',
                type: 'file',
                content: '// Write your code here',
                parentId: null
            });
            roomFilesMap[roomId] = files;
        }

        io.to(socket.id).emit(ACTIONS.SYNC_CHAT, { messages });
        io.to(socket.id).emit(ACTIONS.SYNC_FILES, { files });
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

    socket.on(ACTIONS.EXECUTION_RESULT, ({ roomId, output, language }) => {
        socket.in(roomId).emit(ACTIONS.EXECUTION_RESULT, {
            output,
            language
        });
    });

    // WebRTC Signaling
    // When a user sends a signal (offer/answer/ice), relay it to the specific target
    socket.on(ACTIONS.SIGNAL_CODE, ({ signal, to, from }) => {
        io.to(to).emit(ACTIONS.SIGNAL_CODE, { signal, from });
    });

    // Whiteboard signaling
    socket.on(ACTIONS.DRAWING_UPDATE, ({ roomId, changes }) => {
        // console.log(`Drawing update in room ${roomId}`); 
        socket.in(roomId).emit(ACTIONS.DRAWING_UPDATE, { changes });
    });

    socket.on(ACTIONS.QUESTION_CHANGE, ({ roomId, question }) => {
        socket.in(roomId).emit(ACTIONS.QUESTION_CHANGE, { question });
    });

    socket.on(ACTIONS.SYNC_INPUT, ({ roomId, input }) => {
        socket.in(roomId).emit(ACTIONS.SYNC_INPUT, { input });
    });

    // File System Operations
    socket.on(ACTIONS.FILE_CREATED, ({ roomId, file }) => {
        // file: { id, name, type, content, parentId }
        if (!roomFilesMap[roomId]) roomFilesMap[roomId] = [];
        roomFilesMap[roomId].push(file);
        socket.in(roomId).emit(ACTIONS.FILE_CREATED, { file });
    });

    socket.on(ACTIONS.FILE_UPDATED, ({ roomId, fileId, content }) => {
        if (!roomFilesMap[roomId]) return;
        const file = roomFilesMap[roomId].find(f => f.id === fileId);
        if (file) {
            file.content = content;
            socket.in(roomId).emit(ACTIONS.FILE_UPDATED, { fileId, content });
        }
    });

    socket.on(ACTIONS.FILE_RENAMED, ({ roomId, fileId, newName }) => {
        if (!roomFilesMap[roomId]) return;
        const file = roomFilesMap[roomId].find(f => f.id === fileId);
        if (file) {
            file.name = newName;
            socket.in(roomId).emit(ACTIONS.FILE_RENAMED, { fileId, newName });
        }
    });

    socket.on(ACTIONS.FILE_DELETED, ({ roomId, fileId }) => {
        if (!roomFilesMap[roomId]) return;
        roomFilesMap[roomId] = roomFilesMap[roomId].filter(f => f.id !== fileId);
        socket.in(roomId).emit(ACTIONS.FILE_DELETED, { fileId });
    });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));