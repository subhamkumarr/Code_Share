const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
    JOIN_REQUEST: 'join-request', // Specific for video chat to ask for existing peers
    SIGNAL_CODE: 'signal-code',   // Usage: { signal, to, from }
    DRAWING_UPDATE: 'drawing-update',
    SEND_MESSAGE: 'send-message',
    RECEIVE_MESSAGE: 'receive-message',
    SYNC_CHAT: 'sync-chat',
    TYPING_START: 'typing-start',
    TYPING_STOP: 'typing-stop',
    EXECUTION_RESULT: 'execution-result',
    SYNC_INPUT: 'sync-input',

    // File System Actions
    SYNC_FILES: 'sync-files',
    FILE_CREATED: 'file-created',
    FILE_UPDATED: 'file-updated',
    FILE_RENAMED: 'file-renamed',
    FILE_DELETED: 'file-deleted',
    QUESTION_CHANGE: 'question-change',
};

module.exports = ACTIONS;