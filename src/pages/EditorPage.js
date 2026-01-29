import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import Client from "../components/Client";
import ACTIONS from "../Actions";
import Editor from "../components/Editor";
import Chat from "../components/Chat";
import Compiler from "../components/Compiler";
import Board from "../components/Board";
import Question from "../components/Question";
import { initSocket } from "../socket";
import {
  useLocation,
  useNavigate,
  Navigate,
  useParams,
} from "react-router-dom";

const EditorPage = () => {

  const [activeTab, setActiveTab] = useState('editor');
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const hasShownSocketErrorRef = useRef(false);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();

  const [clients, setClients] = useState([]);
  const [socketInitialized, setSocketInitialized] = useState(false);

  // Code State
  const [code, setCode] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        socketRef.current = await initSocket();
        setSocketInitialized(true);

        socketRef.current.on("connect_error", (err) => handleErrors(err));
        socketRef.current.on("connect_failed", (err) => handleErrors(err));

        function handleErrors(e) {
          console.log("socket error", e);
          if (!hasShownSocketErrorRef.current) {
            hasShownSocketErrorRef.current = true;
            toast.error("Socket connection failed, trying to reconnect…");
          }
        }

        function handleConnect() {
          joinRoom();
        }

        socketRef.current.on('connect', handleConnect);

        if (socketRef.current.connected) {
          handleConnect();
        }

        function joinRoom() {
          socketRef.current.emit(ACTIONS.JOIN, {
            roomId,
            username: location.state?.username,
          });

        }

        //listening for joined event
        socketRef.current.on(
          ACTIONS.JOINED,
          ({ clients, username, socketId }) => {
            if (username !== location.state?.username) {
              toast.success(`${username} joined the room.`)
              console.log(`${username} joined.`);
            }

            setClients(clients);

            // Sync user code on join
            socketRef.current.emit(ACTIONS.SYNC_CODE, {
              code: codeRef.current,
              socketId,
            });
          }
        );

        // Listen for remote code changes
        socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
          if (code !== null) {
            setCode(code);
            codeRef.current = code;
          }
        });

        //listening for disconnected
        socketRef.current.on(
          ACTIONS.DISCONNECTED,
          ({ socketId, username }) => {
            toast.success(`${username} left the room.`);
            setClients((prev) => {
              return prev.filter(
                (client) => client.socketId !== socketId
              );
            });
          }
        );
      } catch (error) {
        console.error('Socket initialization error:', error);
        const errorMsg = error.message || 'Unknown error';
        toast.error(`Socket connection failed: ${errorMsg}`, {
          duration: 5000,
        });
        console.error('Full error details:', error);
      }
    };
    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off(ACTIONS.CODE_CHANGE);
        socketRef.current.off("connect_error");
        socketRef.current.off("connect_failed");
        socketRef.current.disconnect();
      }
    }

  }, [roomId, location.state]);

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success('Room ID has been copied to your clipboard');
    } catch (err) {
      toast.error('Could not copy the Room ID');
    }
  }

  function leaveRoom() {
    reactNavigator('/');
  }

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!location.state) {
    return <Navigate to="/" />;
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };


  return (
    <div className={`mainWrap ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src="/logo.png" alt="logo" />
          </div>

          <h3>Connected</h3>
          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>
        <div className="asideFooter">
          <button className="btn copyBtn" onClick={copyRoomId}>Copy Room ID</button>
          <button className="btn leaveBtn" onClick={leaveRoom}>Leave</button>
        </div>
      </div>

      {/* Sidebar Toggle Button (Visible when collapsed or expanded, positioned absolutely or fixed) */}
      <button className="sidebarToggleBtn" onClick={toggleSidebar}>
        {isSidebarOpen ? '◀' : '▶'}
      </button>
      <div className="editorWrap">
        {/* Tabs for Editor / Whiteboard */}
        <div style={{ display: 'flex', background: '#1c1e29', borderBottom: '1px solid #44475a' }}>
          <button
            onClick={() => setActiveTab('editor')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'editor' ? '#282a36' : 'transparent',
              color: activeTab === 'editor' ? '#4aee88' : '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              borderTop: activeTab === 'editor' ? '2px solid #4aee88' : '2px solid transparent'
            }}
          >
            Code Editor
          </button>
          <button
            onClick={() => setActiveTab('board')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'board' ? '#282a36' : 'transparent',
              color: activeTab === 'board' ? '#4aee88' : '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              borderTop: activeTab === 'board' ? '2px solid #4aee88' : '2px solid transparent'
            }}
          >
            Whiteboard
          </button>
          <button
            onClick={() => setActiveTab('question')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'question' ? '#282a36' : 'transparent',
              color: activeTab === 'question' ? '#4aee88' : '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              borderTop: activeTab === 'question' ? '2px solid #4aee88' : '2px solid transparent'
            }}
          >
            Question
          </button>
        </div>

        {/* Use Visibility/Z-Index to keep state alive and avoid remounting/resizing issues */}
        <div style={{ position: 'relative', height: 'calc(100% - 42px)', overflow: 'hidden' }}>

          {/* Editor Container */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            visibility: activeTab === 'editor' ? 'visible' : 'hidden',
            zIndex: activeTab === 'editor' ? 10 : 0,
            opacity: activeTab === 'editor' ? 1 : 0
          }}>
            <Editor
              socketRef={socketRef}
              roomId={roomId}
              onCodeChange={(code) => {
                codeRef.current = code;
                setCode(code);
                socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code });
              }}
              code={code}
            />
            <Compiler
              socketRef={socketRef}
              roomId={roomId}
              code={code}
              language="javascript"
            />
          </div>

          {/* Whiteboard Container */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            visibility: activeTab === 'board' ? 'visible' : 'hidden',
            zIndex: activeTab === 'board' ? 10 : 0,
            opacity: activeTab === 'board' ? 1 : 0
          }}>
            <Board socketRef={socketRef} roomId={roomId} />
          </div>

          {/* Question Container */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            visibility: activeTab === 'question' ? 'visible' : 'hidden',
            zIndex: activeTab === 'question' ? 10 : 0,
            opacity: activeTab === 'question' ? 1 : 0,
            backgroundColor: '#1c1e29'
          }}>
            <Question socketRef={socketRef} roomId={roomId} />
          </div>
        </div>
      </div>
      <Chat
        socketRef={socketRef}
        username={location.state?.username}
        roomId={roomId}
      />
    </div>
  );
};

export default EditorPage;
