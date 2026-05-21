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
    const [status, setStatus] = useState('checking');

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

    const styles = {
        ok:      { dot: 'bg-ok',     ring: 'border-ok/40',     label: 'Online'   },
        error:   { dot: 'bg-accent', ring: 'border-accent/40', label: 'Offline'  },
        checking:{ dot: 'bg-warn animate-pulse', ring: 'border-warn/40', label: 'Checking' },
    }[status];

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-3 bg-paper-3/50 border ${styles.ring} rounded-pill`}>
            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
            {styles.label}
        </span>
    );
}

export default function Chat({ user, onLogout }) {
    const [sessionId, setSessionId] = useState(() => {
        return localStorage.getItem(LS_KEY) || genSessionId();
    });
    const [messages, setMessages] = useState([]);
    const [javaVersion, setJavaVersion] = useState('8');
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState(['8', '17', '21']);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        localStorage.setItem(LS_KEY, sessionId);
    }, [sessionId]);

    useEffect(() => {
        chatAPI.getVersions()
            .then(res => {
                setVersions(res.data.versions);
                setJavaVersion(res.data.default);
            })
            .catch(() => {});
    }, []);

    const loadHistory = useCallback(async (sid) => {
        setHistoryLoading(true);
        setMessages([]);
        try {
            const res = await chatAPI.getHistory(sid);
            setMessages(res.data.messages || []);
        } catch {
            // new session
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

        const streamingMsg = {
            role: 'assistant',
            content: '',
            citations: [],
            timestamp: new Date().toISOString(),
            streaming: true,
        };
        setMessages(prev => [...prev, streamingMsg]);

        const { events } = chatAPI.streamMessage(sessionId, message, javaVersion);

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
                        last.content = `⚠ ${event.message}`;
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
                    last.content = last.content || '⚠ Connection error. Please try again.';
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
        <div className="flex h-screen text-ink overflow-hidden">
            <SessionSidebar
                currentSessionId={sessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
            />

            <div className="flex flex-col flex-1 min-w-0">
                {/* Header */}
                <header className="bg-paper-2/60 backdrop-blur-sm border-b border-rule px-4 py-3 flex-shrink-0">
                    <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <h1 className="font-display text-base font-semibold text-ink tracking-tight truncate">
                                Java Docs <span className="text-accent">Assistant</span>
                            </h1>
                            <HealthBadge />
                        </div>
                        <div className="flex items-center gap-2">
                            {user && (
                                <span className="hidden sm:inline-block text-[11px] font-mono text-ink-4 truncate max-w-[14ch]">
                                    {user.email}
                                </span>
                            )}
                            <VersionSelector
                                versions={versions}
                                current={javaVersion}
                                onChange={setJavaVersion}
                            />
                            {onLogout && (
                                <button
                                    onClick={onLogout}
                                    className="btn-ghost text-[11px] font-mono uppercase tracking-wider hover:text-accent"
                                    title="Sign out"
                                >
                                    Sign out
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                <MessageList
                    messages={messages}
                    loading={loading || historyLoading}
                    onPickStarter={handleSendMessage}
                />

                <MessageInput
                    onSend={handleSendMessage}
                    disabled={loading || historyLoading}
                />
            </div>
        </div>
    );
}
