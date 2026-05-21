import React, { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { chatAPI } from '../api/client';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VersionSelector from './VersionSelector';
import SessionSidebar from './SessionSidebar';

const LS_KEY = 'jdk_chat_session_id';

export function genSessionId() {
    return 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function HealthBadge() {
    const [status, setStatus] = useState('checking');

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            try {
                const res = await chatAPI.health();
                if (!cancelled) {
                    const { status: s, rag_ready } = res.data;
                    if (s !== 'ok' && s !== 'degraded') setStatus('error');
                    else if (!rag_ready) setStatus('warming');
                    else setStatus('ok');
                }
            } catch {
                if (!cancelled) setStatus('error');
            }
        };
        check();
        const id = setInterval(check, 15000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    const styles = {
        ok:       { dot: 'bg-ok',     ring: 'border-ok/40',     label: 'Online'   },
        warming:  { dot: 'bg-warn animate-pulse', ring: 'border-warn/40', label: 'Warming up' },
        error:    { dot: 'bg-accent', ring: 'border-accent/40', label: 'Offline'  },
        checking: { dot: 'bg-ink-4 animate-pulse', ring: 'border-rule',   label: 'Checking' },
    }[status] || { dot: 'bg-ink-4', ring: 'border-rule', label: status };

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-3 bg-paper-3/50 border ${styles.ring} rounded-pill`}
            role="status"
            aria-label={`Backend status: ${styles.label}`}
            title={status === 'warming' ? 'RAG index building — queries will work once ready (first deploy only)' : undefined}
        >
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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

    const streamRef = useRef(null);
    const sessionIdRef = useRef(sessionId);
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

    const abortStream = useCallback(() => {
        if (streamRef.current) {
            try { streamRef.current.abort(); } catch {}
            streamRef.current = null;
        }
    }, []);

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
            if (sessionIdRef.current === sid) {
                setMessages(res.data.messages || []);
            }
        } catch {
            // new session
        } finally {
            if (sessionIdRef.current === sid) setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHistory(sessionId);
        return () => abortStream();
    }, [sessionId, loadHistory, abortStream]);

    const handleSelectSession = (sid) => {
        if (sid === sessionId) return;
        abortStream();
        setLoading(false);
        setSessionId(sid);
        setSidebarOpen(false);
    };

    const handleNewSession = () => {
        abortStream();
        setLoading(false);
        const sid = genSessionId();
        setMessages([]);
        setSessionId(sid);
        setSidebarOpen(false);
    };

    const handleSendMessage = async (message) => {
        const text = (message || '').trim();
        if (!text || !sessionId || loading) return;

        const startedInSession = sessionId;

        setMessages(prev => [...prev, {
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        }, {
            role: 'assistant',
            content: '',
            citations: [],
            timestamp: new Date().toISOString(),
            streaming: true,
        }]);
        setLoading(true);

        const stream = chatAPI.streamMessage(startedInSession, text, javaVersion);
        streamRef.current = stream;

        try {
            for await (const event of stream.events()) {
                if (sessionIdRef.current !== startedInSession) break;
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
                    setSidebarRefreshKey(k => k + 1);
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
            if (err.name !== 'AbortError' && sessionIdRef.current === startedInSession) {
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
            if (sessionIdRef.current === startedInSession) setLoading(false);
            if (streamRef.current === stream) streamRef.current = null;
        }
    };

    return (
        <div className="flex h-screen text-ink overflow-hidden">
            {/* Sidebar — slide-over on mobile */}
            <div
                className={`fixed inset-0 z-30 lg:hidden transition-opacity duration-short ease-out ${
                    sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setSidebarOpen(false)}
                aria-hidden={!sidebarOpen}
            >
                <div className="absolute inset-0 bg-paper/80 backdrop-blur-sm" />
            </div>
            <div
                className={`fixed lg:static inset-y-0 left-0 z-40 transform transition-transform duration-short ease-out lg:transform-none ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                <SessionSidebar
                    currentSessionId={sessionId}
                    onSelectSession={handleSelectSession}
                    onNewSession={handleNewSession}
                    refreshKey={sidebarRefreshKey}
                />
            </div>

            <div className="flex flex-col flex-1 min-w-0">
                {/* Header */}
                <header className="bg-paper-2/60 backdrop-blur-sm border-b border-rule px-3 sm:px-5 py-3 flex-shrink-0">
                    <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden btn-ghost p-1.5"
                                aria-label="Open sessions"
                            >
                                <span className="block w-4 h-[2px] bg-current mb-1" />
                                <span className="block w-4 h-[2px] bg-current mb-1" />
                                <span className="block w-4 h-[2px] bg-current" />
                            </button>
                            <span className="wordmark-dot hidden sm:inline-block" />
                            <h1 className="font-display text-base font-semibold text-ink tracking-tight truncate">
                                Java Docs <span className="text-accent">Assistant</span>
                            </h1>
                            <HealthBadge />
                        </div>
                        <div className="flex items-center gap-2">
                            {user && (
                                <span className="hidden sm:inline-block text-[11px] font-mono text-ink-4 truncate max-w-[18ch]">
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
                    disabled={loading}
                />

                <MessageInput
                    onSend={handleSendMessage}
                    disabled={loading || historyLoading}
                />
            </div>
        </div>
    );
}
