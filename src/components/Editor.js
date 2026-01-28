import React, { useEffect, useRef } from 'react'

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



const Editor = ({ socketRef, roomId, onCodeChange, code }) => {

  const editorRef = useRef(null);


  useEffect(() => {
    async function init() {
      const textarea = document.getElementById('realtimeEditor');
      if (!textarea) {
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
        const { origin } = changes;
        const code = instance.getValue();
        onCodeChange(code);
      });
    }
    init();
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      // Only update if the new code is different to prevent cursor jumping or loops
      // But CodeMirror `setValue` might reset cursor.
      // Better to check value.
      const currentVal = editorRef.current.getValue();
      if (code !== currentVal) {
        editorRef.current.setValue(code);
      }
    }
  }, [code]);

  return <textarea id='realtimeEditor'></textarea>
};

export default Editor;