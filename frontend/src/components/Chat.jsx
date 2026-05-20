import React, { useState, useEffect, useCallback } from 'react';
import { chatAPI } from '../api/client';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VersionSelector from './VersionSelector';
import SessionSidebar from './SessionSidebar';

const LS_KEY = 'jdk_chat_session_id';

function genSessionId() {
    return 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function HealthBadge() {
    const [status, setStatus] = useState('checking'); // 'ok' | 'error' | 'checking'

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            try {
                await chatAPI.health();
                if (!cancelled) setStatus('ok');
            } catch {
                if (!cancelled) setStatus('error');
            }
        };
        check();
        const id = setInterval(check, 30000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    const dot = status === 'ok'
        ? 'bg-emerald-400'
        : status === 'error'
        ? 'bg-red-500'
        : 'bg-yellow-400 animate-pulse';

    const label = status === 'ok' ? 'Online' : status === 'error' ? 'Offline' : 'Checking';

    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {label}
        </span>
    );
}

export default function Chat() {
    const [sessionId, setSessionId] = useState(() => {
        return localStorage.getItem(LS_KEY) || genSessionId();
    });
    const [messages, setMessages] = useState([]);
    const [javaVersion, setJavaVersion] = useState('8');
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState(['8', '17', '21']);
    const [historyLoading, setHistoryLoading] = useState(false);

    // persist session id
    useEffect(() => {
        localStorage.setItem(LS_KEY, sessionId);
    }, [sessionId]);

    // load versions
    useEffect(() => {
        chatAPI.getVersions()
            .then(res => {
                setVersions(res.data.versions);
                setJavaVersion(res.data.default);
            })
            .catch(() => {});
    }, []);

    // load history when session changes
    const loadHistory = useCallback(async (sid) => {
        setHistoryLoading(true);
        setMessages([]);
        try {
            const res = await chatAPI.getHistory(sid);
            setMessages(res.data.messages || []);
        } catch {
            // new session — no history
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHistory(sessionId);
    }, [sessionId, loadHistory]);

    const handleSelectSession = (sid) => {
        if (sid === sessionId) return;
        setSessionId(sid);
    };

    const handleNewSession = () => {
        const sid = genSessionId();
        setSessionId(sid);
        setMessages([]);
    };

    const handleSendMessage = async (message) => {
        if (!message.trim() || !sessionId) return;

        setMessages(prev => [...prev, {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
        }]);
        setLoading(true);

        // placeholder streaming message
        const streamingMsg = {
            role: 'assistant',
            content: '',
            citations: [],
            timestamp: new Date().toISOString(),
            streaming: true,
        };
        setMessages(prev => [...prev, streamingMsg]);

        const { events, abort } = chatAPI.streamMessage(sessionId, message, javaVersion);

        try {
            for await (const event of events()) {
                if (event.type === 'token') {
                    setMessages(prev => {
                        const next = [...prev];
                        const last = { ...next[next.length - 1] };
                        last.content += event.text;
                        next[next.length - 1] = last;
                        return next;
                    });
                } else if (event.type === 'citations') {
                    setMessages(prev => {
                        const next = [...prev];
                        const last = { ...next[next.length - 1] };
                        last.citations = event.citations;
                        next[next.length - 1] = last;
                        return next;
                    });
                } else if (event.type === 'done') {
                    setMessages(prev => {
                        const next = [...prev];
                        const last = { ...next[next.length - 1] };
                        last.streaming = false;
                        next[next.length - 1] = last;
                        return next;
                    });
                } else if (event.type === 'error') {
                    setMessages(prev => {
                        const next = [...prev];
                        const last = { ...next[next.length - 1] };
                        last.content = `⚠️ ${event.message}`;
                        last.streaming = false;
                        next[next.length - 1] = last;
                        return next;
                    });
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setMessages(prev => {
                    const next = [...prev];
                    const last = { ...next[next.length - 1] };
                    last.content = last.content || '⚠️ Connection error. Please try again.';
                    last.streaming = false;
                    next[next.length - 1] = last;
                    return next;
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
            {/* Sidebar */}
            <SessionSidebar
                currentSessionId={sessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
            />

            {/* Main area */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* Header */}
                <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-bold text-white">Java Docs Assistant</h1>
                            <HealthBadge />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 font-mono">
                                {sessionId.slice(0, 16)}…
                            </span>
                            <VersionSelector
                                versions={versions}
                                current={javaVersion}
                                onChange={setJavaVersion}
                            />
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <MessageList
                    messages={messages}
                    loading={loading || historyLoading}
                />

                {/* Input */}
                <MessageInput
                    onSend={handleSendMessage}
                    disabled={loading || historyLoading}
                />
            </div>
        </div>
    );
}
