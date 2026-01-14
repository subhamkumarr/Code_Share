import React, { useState, useEffect, useRef } from 'react';
import Avatar from 'react-avatar';
import ACTIONS from '../Actions';

const Chat = ({ socketRef, username, roomId }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isOpenRef = useRef(false);
  const messagesEndRef = useRef(null);

  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleInput = (e) => {
    setMessage(e.target.value);

    // Emit typing start
    if (!socketRef.current) return;

    socketRef.current.emit(ACTIONS.TYPING_START, { roomId, username });

    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Set timeout to stop typing after 1s of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit(ACTIONS.TYPING_STOP, { roomId, username });
    }, 1000);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for incoming messages - EXACT SAME PATTERN AS EDITOR
  useEffect(() => {
    if (!socketRef.current) {
      console.log('Chat: Socket not available yet');
      return;
    }

    const handleReceiveMessage = ({ username: senderUsername, message: msg }) => {
      console.log('\n=== RECEIVED CHAT MESSAGE ===');
      console.log('From:', senderUsername);
      console.log('Message:', msg);
      console.log('Current user:', username);
      console.log('Socket ID:', socketRef.current?.id);
      console.log('=============================\n');

      // Add message to state
      setMessages((prev) => [
        ...prev,
        {
          username: senderUsername,
          message: msg,
          timestamp: new Date().toLocaleTimeString(),
          isOwn: senderUsername === username,
        },
      ]);

      const isOwn = senderUsername === username;
      if (!isOpenRef.current && !isOwn) {
        setUnreadCount(prev => prev + 1);
      }
    };

    const handleTypingStart = ({ username: typer }) => {
      if (typer !== username) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.add(typer);
          return newSet;
        });
      }
    };

    const handleTypingStop = ({ username: typer }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(typer);
        return newSet;
      });
    };

    const handleSyncChat = ({ messages: history }) => {
      console.log('Chat: Syncing history', history);
      const formattedHistory = history.map(msg => ({
        ...msg,
        isOwn: msg.username === username,
      }));
      setMessages(formattedHistory);
    };

    // Remove any existing listener first to prevent duplicates
    socketRef.current.off(ACTIONS.RECEIVE_MESSAGE, handleReceiveMessage);
    socketRef.current.off(ACTIONS.SYNC_CHAT, handleSyncChat);

    // Set up listener when socket is available - SAME AS EDITOR
    const setupListener = () => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.on(ACTIONS.RECEIVE_MESSAGE, handleReceiveMessage);
        socketRef.current.on(ACTIONS.SYNC_CHAT, handleSyncChat);
        console.log('Chat: ✓ Listener set up for RECEIVE_MESSAGE and SYNC_CHAT');
      }
    };

    // Set up listener immediately if socket exists and is connected
    if (socketRef.current.connected) {
      setupListener();
    }

    // Also listen for connect event in case socket connects later
    const onConnect = () => {
      setupListener();
    };
    socketRef.current.on('connect', onConnect);

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.RECEIVE_MESSAGE, handleReceiveMessage);
        socketRef.current.off(ACTIONS.SYNC_CHAT, handleSyncChat);
        socketRef.current.off(ACTIONS.TYPING_START, handleTypingStart);
        socketRef.current.off(ACTIONS.TYPING_STOP, handleTypingStop);
        socketRef.current.off('connect', onConnect);
        console.log('Chat: Listener cleaned up');
      }
    };
  }, [username, roomId, socketRef.current]) // Re-setup listener if username, roomId or socket changes

  // Send message - EXACT SAME PATTERN AS CODE_CHANGE
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !socketRef.current) {
      console.log('Chat: Cannot send - message empty or socket not available');
      return;
    }

    // Emit message to server - SAME PATTERN AS CODE_CHANGE
    const messageToSend = message.trim();
    console.log('\n=== SENDING CHAT MESSAGE ===');
    console.log('Room ID:', roomId);
    console.log('Username:', username);
    console.log('Message:', messageToSend);
    console.log('Socket connected:', socketRef.current.connected);
    console.log('Socket ID:', socketRef.current.id);

    if (socketRef.current.connected) {
      socketRef.current.emit(ACTIONS.SEND_MESSAGE, {
        roomId,
        username,
        message: messageToSend,
      });
      console.log('✓ Message emitted to server');
    } else {
      console.log('⚠ Socket not connected, waiting...');
      // Wait for connection if not connected
      socketRef.current.once('connect', () => {
        socketRef.current.emit(ACTIONS.SEND_MESSAGE, {
          roomId,
          username,
          message: messageToSend,
        });
      });
    }
    console.log('===========================\n');

    // Add own message to local state immediately
    setMessages((prev) => [
      ...prev,
      {
        username,
        message: message.trim(),
        timestamp: new Date().toLocaleTimeString(),
        isOwn: true,
      },
    ]);

    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="chatContainer">
      {/* Chat Toggle Button */}
      <button
        className="chatToggleBtn"
        onClick={toggleChat}
        title={isOpen ? 'Close Chat' : 'Open Chat'}
      >
        {isOpen ? '✕' : '💬'}
        {!isOpen && unreadCount > 0 && (
          <span className="chatNotificationBadge">{unreadCount}</span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatWindow">
          <div className="chatHeader">
            <h3>Chat</h3>
            <button className="chatCloseBtn" onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className="chatMessages">
            {messages.length === 0 ? (
              <div className="chatEmptyState">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={`${msg.username}-${msg.timestamp}-${index}`}
                  className={`chatMessage ${msg.isOwn ? 'ownMessage' : ''}`}
                >
                  {!msg.isOwn && (
                    <Avatar
                      name={msg.username}
                      size="32"
                      round="16px"
                      className="chatAvatar"
                    />
                  )}
                  <div className="messageContent">
                    {!msg.isOwn && (
                      <span className="messageUsername">{msg.username}</span>
                    )}
                    <div className="messageText">
                      {msg.message.split('`').map((part, i) =>
                        i % 2 === 1 ? <code key={i}>{part}</code> : part
                      )}
                    </div>
                    <span className="messageTime">{msg.timestamp}</span>
                  </div>
                </div>
              ))
            )}
            {/* Typing Indicator */}
            {typingUsers.size > 0 && (
              <div className="typingIndicator">
                {Array.from(typingUsers).join(', ')} is typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chatInputForm" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="chatInput"
              placeholder="Type a message... (Markdown supported)"
              value={message}
              onChange={handleInput}
              onKeyPress={handleKeyPress}
            />
            <button type="submit" className="chatSendBtn" disabled={!message.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Chat;
