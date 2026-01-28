import React, { useState, useEffect } from 'react';
import ACTIONS from '../Actions';
import toast from 'react-hot-toast';

const Question = ({ socket, roomId }) => {
    const [url, setUrl] = useState('');
    const [question, setQuestion] = useState(null);
    const [loading, setLoading] = useState(false);

    const matchSlug = (input) => {
        // Remove trailing slashes
        input = input.replace(/\/$/, '');

        // Match url like https://leetcode.com/problems/two-sum
        const urlRegex = /problems\/([a-zA-Z0-9-]+)/;
        const match = input.match(urlRegex);
        if (match) return match[1];

        // If it's a number, we can't easily map it to a slug without another API call.
        // For now, assume it's a title or slug.

        // Convert "Two Sum" -> "two-sum"
        return input.trim().toLowerCase().replace(/\s+/g, '-');
    };

    const fetchProblem = async () => {
        if (/^\d+$/.test(url.trim())) {
            toast.error('Fetching by ID is not supported. Please use the Name (e.g. "Two Sum").');
            return;
        }

        const slug = matchSlug(url);
        if (!slug) {
            toast.error('Invalid URL or Slug');
            return;
        }
        setLoading(true);
        try {
            // Use relative path in production (served by same origin)
            // Use localhost:5000 in dev
            const apiBase = process.env.NODE_ENV === 'production'
                ? ''
                : 'http://localhost:5000';

            console.log(`Fetching from: ${apiBase}/api/problem`);

            const res = await fetch(`${apiBase}/api/problem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || `Server returned ${res.status}`);
            }

            const data = await res.json();
            if (data.error) {
                toast.error(data.error);
            } else {
                setQuestion(data);
                // Broadcast to others
                socket.emit(ACTIONS.QUESTION_CHANGE, { roomId, question: data });
            }
        } catch (err) {
            console.error(err);
            toast.error(`Fetch failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!socket) return;

        const handleQuestionChange = ({ question }) => {
            setQuestion(question);
        };

        socket.on(ACTIONS.QUESTION_CHANGE, handleQuestionChange);

        return () => {
            socket.off(ACTIONS.QUESTION_CHANGE, handleQuestionChange);
        };
    }, [socket]);

    return (
        <div style={{ color: '#fff', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px', background: '#282a36', borderBottom: '1px solid #44475a', display: 'flex', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="Enter LeetCode URL or Slug (e.g. two-sum)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchProblem()}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '4px',
                        border: '1px solid #6272a4',
                        background: '#44475a',
                        color: '#fff'
                    }}
                />
                <button
                    onClick={fetchProblem}
                    disabled={loading}
                    className="btn loginBtn"
                    style={{ height: 'auto', width: '100px' }}
                >
                    {loading ? 'Loading...' : 'Fetch'}
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {question ? (
                    <div>
                        <h2 style={{ marginBottom: '10px' }}>
                            {question.questionId}. {question.title}
                            <span style={{
                                fontSize: '14px',
                                marginLeft: '10px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: question.difficulty === 'Easy' ? '#00b894' : question.difficulty === 'Medium' ? '#fdcb6e' : '#d63031',
                                color: '#2d3436'
                            }}>
                                {question.difficulty}
                            </span>
                        </h2>
                        <div
                            dangerouslySetInnerHTML={{ __html: question.content }}
                            style={{ lineHeight: '1.6', fontSize: '16px' }}
                            className="problem-content"
                        />
                    </div>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#6272a4' }}>
                        <h3>Enter a problem URL to start solving!</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Question;
