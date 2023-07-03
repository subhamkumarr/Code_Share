import React, {useEffect} from 'react'

import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
 import 'codemirror/mode/javascript/javascript';
//  import 'codemirror/mode/python/python';
// import 'codemirror/addon/search/match-highlighter';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';



const Editor = () => {

  useEffect(() => {
    async function init() {
        Codemirror.fromTextArea(document.getElementById('realtimeEditor'), {
            mode: { name: 'javascript', json: true },
            // mode: { name: 'python'},
            // highlightSelectionMatches: {
            //   minChars: 2,
            //   showToken: /Hello/,
            //   style:'matchhighlight'
            // },
            theme: 'dracula',
            autoCloseTags: true,
            autoCloseBrackets: true,
            lineNumbers: true,
            styleActiveLine: true,
            styleActiveSelected: true,
        });
    }
    init();
  }, []);

  return <textarea id='realtimeEditor'></textarea>
};

export default Editor;