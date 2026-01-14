import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import Client from "../components/Client";
import ACTIONS from "../Actions";
import Editor from "../components/Editor";
import Chat from "../components/Chat";
import Compiler from "../components/Compiler";
import { initSocket } from "../socket";

import {
  useLocation,
  useNavigate,
  Navigate,
  useParams,
} from "react-router-dom";

const EditorPage = () => {

  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const hasShownSocketErrorRef = useRef(false);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();

  const [clients, setClients] = useState([]);
  const [socketInitialized, setSocketInitialized] = useState(false);
  const [currentCode, setCurrentCode] = useState('');


  useEffect(() => {
    const init = async () => {
      try {
        socketRef.current = await initSocket();
        setSocketInitialized(true);

        socketRef.current.on("connect_error", (err) => handleErrors(err));
        socketRef.current.on("connect_failed", (err) => handleErrors(err));

        function handleErrors(e) {
          console.log("socket error", e);
          // Render (and other hosts) can briefly fail during cold starts or retries.
          // Show a single toast but let socket.io keep reconnecting.
          if (!hasShownSocketErrorRef.current) {
            hasShownSocketErrorRef.current = true;
            toast.error("Socket connection failed, trying to reconnect…");
          }
        }

        // Always rejoin room on connection (handling reconnects)
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

            // Only sync code if this is a new user joining (not the current user)
            // and we have code to sync
            if (socketId !== socketRef.current.id && codeRef.current != null) {
              socketRef.current.emit(ACTIONS.SYNC_CODE, {
                code: codeRef.current,
                socketId,
              });
            }
          }
        );

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
        toast.error("Failed to initialize socket connection. Please refresh and try again.");
      }
    };
    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off("connect_error");
        socketRef.current.off("connect_failed");
        socketRef.current.disconnect();
      }
    }

  }, []);

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
        <Editor
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
            setCurrentCode(code);
          }}
        />
        <Compiler
          socketRef={socketRef}
          roomId={roomId}
          code={currentCode}
          language="javascript"
        />
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
