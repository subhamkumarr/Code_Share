import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';

const Compiler = ({ socketRef, roomId, code, language = 'javascript' }) => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(language);

  const executeCode = async () => {
    if (!code || !code.trim()) {
      toast.error('No code to execute');
      return;
    }

    setIsExecuting(true);
    setOutput('Executing...\n');

    try {
      if (selectedLanguage === 'javascript') {
        executeJavaScript(code, input);
      } else {
        await executeOnServer(code, input, selectedLanguage);
      }
    } catch (error) {
      setOutput(`Error: ${error.message}`);
      toast.error('Execution failed');
      setIsExecuting(false);
    }
  };

  const executeJavaScript = (code, input) => {
    try {
      let consoleOutput = [];
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;

      console.log = (...args) => {
        consoleOutput.push(args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      };

      console.error = (...args) => {
        consoleOutput.push('ERROR: ' + args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      };

      console.warn = (...args) => {
        consoleOutput.push('WARN: ' + args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      };

      const inputLines = input.split('\n');
      let inputIndex = 0;
      const readline = () => inputLines[inputIndex++] || '';

      const wrappedCode = `
        (function() {
          ${code}
        })();
      `;

      const timeoutId = setTimeout(() => {
        throw new Error('Execution timeout: Code took too long to execute');
      }, 5000);

      let result;
      try {
        result = eval(wrappedCode);
      } finally {
        clearTimeout(timeoutId);
      }

      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      let outputText = '';
      if (consoleOutput.length > 0) {
        outputText = consoleOutput.join('\n');
      }
      if (result !== undefined && result !== null) {
        const resultStr = typeof result === 'object'
          ? JSON.stringify(result, null, 2)
          : String(result);
        outputText += (outputText ? '\n' : '') + resultStr;
      }

      setOutput(outputText || 'Code executed successfully (no output)');
      setIsExecuting(false);

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit(ACTIONS.EXECUTION_RESULT, {
          roomId,
          output: outputText || 'Code executed successfully (no output)',
          language: selectedLanguage,
        });
      }
    } catch (error) {
      console.log = console.log || (() => { });
      console.error = console.error || (() => { });
      console.warn = console.warn || (() => { });

      setOutput(`Runtime Error: ${error.message}\n${error.stack || ''}`);
      setIsExecuting(false);
      toast.error('JavaScript execution error');
    }
  };

  const executeOnServer = async (code, input, lang) => {
    try {
      // Determine backend URL (handled similar to socket.js)
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      // Default to localhost:5000 for dev if not specified
      const backendUrl = process.env.REACT_APP_BACKEND_URL
        || (isLocalhost ? 'http://localhost:5000' : window.location.origin);

      const response = await fetch(`${backendUrl}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language: lang,
          stdin: input,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        setOutput(`Error: ${data.error}`);
      } else {
        let outputText = '';
        if (data.stdout) outputText += data.stdout;
        if (data.stderr) outputText += (outputText ? '\n' : '') + `Error: ${data.stderr}`;
        setOutput(outputText || 'No output');
      }

      setIsExecuting(false);

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit(ACTIONS.EXECUTION_RESULT, {
          roomId,
          output: data.stdout || data.stderr || 'No output',
          language: lang,
        });
      }
    } catch (error) {
      setOutput(`Error: ${error.message}`);
      setIsExecuting(false);
      toast.error('Server execution failed');
    }
  };

  useEffect(() => {
    if (!socketRef.current) return;

    const handleExecutionResult = ({ output, language }) => {
      if (language === selectedLanguage) {
        setOutput(output);
      }
    };

    socketRef.current.on(ACTIONS.EXECUTION_RESULT, handleExecutionResult);

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.EXECUTION_RESULT, handleExecutionResult);
      }
    };
  }, [socketRef.current, selectedLanguage, roomId]);

  return (
    <div className="compilerContainer">
      <div className="compilerHeader">
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="languageSelect"
        >
          <option value="javascript">JavaScript</option>
          <option value="cpp">C++</option>
        </select>
        <button
          onClick={executeCode}
          disabled={isExecuting}
          className="runBtn"
        >
          {isExecuting ? 'Running...' : '▶ Run'}
        </button>
      </div>

      <div className="compilerBody">
        <div className="inputSection">
          <label>Input:</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter input here..."
            className="compilerInput"
          />
        </div>

        <div className="outputSection">
          <label>Output:</label>
          <pre className="compilerOutput">{output || 'Output will appear here...'}</pre>
        </div>
      </div>
    </div>
  );
};

export default Compiler;
