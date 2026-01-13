import React, {useEffect, useRef} from 'react'

import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
 import 'codemirror/mode/javascript/javascript';
//  import 'codemirror/mode/python/python';
// import 'codemirror/addon/search/match-highlighter';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
// import { Socket } from 'socket.io';
import ACTIONS from '../Actions';



const Editor = ({socketRef, roomId, onCodeChange}) => {

  const editorRef = useRef(null);


  useEffect(() => {
    async function init() {
      const textarea = document.getElementById('realtimeEditor');
      if(!textarea) {
        console.error('Textarea element not found');
        return;
      }

      editorRef.current = Codemirror.fromTextArea(textarea, {
        mode: { name: 'javascript', json: true },
        theme: 'dracula',
        autoCloseTags: true,
        autoCloseBrackets: true,
        lineNumbers: true,
        styleActiveLine: true,
        styleActiveSelected: true,
      });
        
        editorRef.current.on('change', (instance, changes) => {
          // console.log('changes',changes);
          const {origin} = changes;
          const code = instance.getValue();
          onCodeChange(code);
          
          if(origin !== 'setValue' && socketRef.current && socketRef.current.connected) {
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
              roomId,
              code,
            } );
          }
          // console.log(code);
        
        });
        // editorRef.current.setValue(`console.log('hello')`);
        
    }
    init();
  }, []);

  useEffect(() => {
    if(!socketRef.current) return;

    const handleCodeChange = ({code}) => {
      // console.log('rece', code);
      if(code != null && editorRef.current) {
        editorRef.current.setValue(code);
      }
    };

    // Wait for socket to be connected before setting up listener
    const setupListener = () => {
      if(socketRef.current && socketRef.current.connected) {
        socketRef.current.on(ACTIONS.CODE_CHANGE, handleCodeChange);
        return true;
      }
      return false;
    };

    // Try to set up immediately
    if(!setupListener()) {
      // If not connected yet, wait for connection
      const onConnect = () => {
        setupListener();
        socketRef.current.off('connect', onConnect);
      };
      socketRef.current.on('connect', onConnect);
    }

    return () => {
      if(socketRef.current) {
        socketRef.current.off(ACTIONS.CODE_CHANGE, handleCodeChange);
        socketRef.current.off('connect');
      }
    };
  }, [socketRef])

  return <textarea id='realtimeEditor'></textarea>
};

export default Editor;