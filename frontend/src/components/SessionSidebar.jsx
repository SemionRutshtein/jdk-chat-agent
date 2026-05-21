import React, { useEffect, useMemo, useState } from 'react';
import { chatAPI } from '../api/client';

const VERSION_CHIP = {
    '8':  { ring: 'border-accent-soft', dot: 'bg-accent-deep', label: 'text-ink-2' },
    '17': { ring: 'border-rule-2',      dot: 'bg-ink-3',       label: 'text-ink-2' },
    '21': { ring: 'border-accent',      dot: 'bg-accent',      label: 'text-ink' },
};

function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function bucketByDay(sessions, now = new Date()) {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    const dayMs = 86400000;
    const today = [];
    const yesterday = [];
    const earlier = [];
    for (const s of sessions) {
        const t = new Date(s.updated_at).getTime();
        if (t >= startMs) today.push(s);
        else if (t >= startMs - dayMs) yesterday.push(s);
        else earlier.push(s);
    }
    return { today, yesterday, earlier };
}

function GroupLabel({ children }) {
    return (
        <div className="px-4 pt-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
            {children}
        </div>
    );
}

function SessionRow({ session, active, onClick }) {
    const v = VERSION_CHIP[session.last_java_version] || { ring: 'border-rule', dot: 'bg-ink-4', label: 'text-ink-3' };
    const title = session.first_message || `Session ${session.session_id.slice(-6)}`;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? 'true' : undefined}
            className={`group w-full text-left px-3 py-2.5 rounded-input relative transition-colors duration-short ease-out ${
                active
                    ? 'bg-paper-3 text-ink accent-bar'
                    : 'text-ink-3 hover:bg-paper-3/60 hover:text-ink-2'
            }`}
        >
            <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-ink-2 line-clamp-1 leading-tight flex-1 min-w-0">
                    {title}
                </span>
                {session.last_java_version && (
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-pill border ${v.ring} ${v.label}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                        J{session.last_java_version}
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-ink-4">
                <span>{session.message_count} msg{session.message_count === 1 ? '' : 's'}</span>
                <span>{formatTime(session.updated_at)}</span>
            </div>
        </button>
    );
}

function SessionGroup({ sessions, label, currentSessionId, onSelectSession }) {
    if (!sessions.length) return null;
    return (
        <>
            <GroupLabel>{label}</GroupLabel>
            <div className="space-y-0.5">
                {sessions.map(s => (
                    <SessionRow
                        key={s.session_id}
                        session={s}
                        active={s.session_id === currentSessionId}
                        onClick={() => onSelectSession(s.session_id)}
                    />
                ))}
            </div>
        </>
    );
}

export default function SessionSidebar({ currentSessionId, onSelectSession, onNewSession, refreshKey }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await chatAPI.getSessions(50);
            setSessions(res.data.sessions || []);
        } catch {
            // silent — auth error handled globally
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [currentSessionId, refreshKey]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return sessions;
        return sessions.filter(s =>
            (s.first_message || '').toLowerCase().includes(q) ||
            s.session_id.toLowerCase().includes(q) ||
            String(s.last_java_version || '').includes(q)
        );
    }, [sessions, query]);

    const groups = useMemo(() => bucketByDay(filtered), [filtered]);
    const hasAny = filtered.length > 0;

    return (
        <aside className="w-72 sm:w-64 h-full flex-shrink-0 bg-paper-2/80 backdrop-blur-md border-r border-rule flex flex-col">
            {/* Wordmark */}
            <div className="px-4 py-4 border-b border-rule flex items-center gap-2">
                <span className="wordmark-dot" />
                <span className="font-display font-semibold text-sm tracking-tight text-ink">jdk · agent</span>
            </div>

            {/* New chat */}
            <div className="p-3">
                <button
                    type="button"
                    onClick={onNewSession}
                    className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
                    aria-label="Start new chat session"
                >
                    <span className="text-base leading-none">+</span> New chat
                </button>
            </div>

            {/* Filter */}
            <div className="px-3 pb-2">
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search sessions…"
                    className="input-base w-full text-xs py-1.5"
                    aria-label="Search sessions"
                />
            </div>

            {/* List */}
            <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Chat sessions">
                {loading && (
                    <div className="space-y-1.5 px-1 pt-1">
                        {[1,2,3].map(i => (
                            <div key={i} className="h-14 bg-paper-3/40 rounded-input animate-pulse" />
                        ))}
                    </div>
                )}

                {!loading && !hasAny && (
                    <div className="px-3 py-8 text-center">
                        <p className="text-xs text-ink-4">
                            {query ? 'No matching sessions' : 'No sessions yet'}
                        </p>
                        {!query && (
                            <p className="text-[11px] text-ink-4 mt-1">Start a new chat above</p>
                        )}
                    </div>
                )}

                {!loading && hasAny && (
                    <>
                        <SessionGroup label="Today" sessions={groups.today} currentSessionId={currentSessionId} onSelectSession={onSelectSession} />
                        <SessionGroup label="Yesterday" sessions={groups.yesterday} currentSessionId={currentSessionId} onSelectSession={onSelectSession} />
                        <SessionGroup label="Earlier" sessions={groups.earlier} currentSessionId={currentSessionId} onSelectSession={onSelectSession} />
                    </>
                )}
            </nav>

            {/* Refresh */}
            <button
                type="button"
                onClick={load}
                disabled={loading}
                className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-ink-4 hover:text-accent border-t border-rule transition-colors duration-short ease-out flex items-center gap-1.5 disabled:opacity-50"
                aria-label="Refresh sessions"
            >
                <span aria-hidden className={loading ? 'animate-spin inline-block' : ''}>↻</span>
                {loading ? 'Loading…' : 'Refresh'}
            </button>
        </aside>
    );
}
