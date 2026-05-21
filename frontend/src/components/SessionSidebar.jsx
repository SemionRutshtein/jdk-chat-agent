import React, { useEffect, useMemo, useState } from 'react';
import { chatAPI } from '../api/client';

const VERSION_CHIP = {
    '8':  { ring: 'border-accent-soft', dot: 'bg-accent-deep', label: 'text-ink-2' },
    '17': { ring: 'border-rule-2',      dot: 'bg-ink-3',       label: 'text-ink-2' },
    '21': { ring: 'border-accent',      dot: 'bg-accent',      label: 'text-ink' },
};

function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? 'true' : undefined}
            className={`group w-full text-left px-3 py-2 rounded-input relative transition-colors duration-short ease-out ${
                active
                    ? 'bg-paper-3 text-ink accent-bar'
                    : 'text-ink-3 hover:bg-paper-3/60 hover:text-ink-2'
            }`}
        >
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono truncate max-w-[8rem]">
                    {session.session_id.slice(8, 22)}
                </span>
                {session.last_java_version && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-pill border ${v.ring} ${v.label}`}>
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

export default function SessionSidebar({ currentSessionId, onSelectSession, onNewSession }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await chatAPI.getSessions(50);
            setSessions(res.data.sessions || []);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [currentSessionId]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return sessions;
        return sessions.filter(s =>
            s.session_id.toLowerCase().includes(q) ||
            String(s.last_java_version || '').includes(q)
        );
    }, [sessions, query]);

    const groups = useMemo(() => bucketByDay(filtered), [filtered]);

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
                    title="New chat session"
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
                    placeholder="Filter sessions…"
                    className="input-base w-full text-xs py-1.5"
                    aria-label="Filter sessions"
                />
            </div>

            {/* List */}
            <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Chat sessions">
                {loading && (
                    <div className="px-3 py-2 text-xs text-ink-4">Loading…</div>
                )}
                {!loading && filtered.length === 0 && (
                    <div className="px-3 py-6 text-xs text-ink-4 text-center">
                        {query ? 'No matches' : 'No sessions yet — start one above.'}
                    </div>
                )}

                {groups.today.length > 0 && <GroupLabel>Today</GroupLabel>}
                <div className="space-y-0.5">
                    {groups.today.map(s => (
                        <SessionRow
                            key={s.session_id}
                            session={s}
                            active={s.session_id === currentSessionId}
                            onClick={() => onSelectSession(s.session_id)}
                        />
                    ))}
                </div>

                {groups.yesterday.length > 0 && <GroupLabel>Yesterday</GroupLabel>}
                <div className="space-y-0.5">
                    {groups.yesterday.map(s => (
                        <SessionRow
                            key={s.session_id}
                            session={s}
                            active={s.session_id === currentSessionId}
                            onClick={() => onSelectSession(s.session_id)}
                        />
                    ))}
                </div>

                {groups.earlier.length > 0 && <GroupLabel>Earlier</GroupLabel>}
                <div className="space-y-0.5">
                    {groups.earlier.map(s => (
                        <SessionRow
                            key={s.session_id}
                            session={s}
                            active={s.session_id === currentSessionId}
                            onClick={() => onSelectSession(s.session_id)}
                        />
                    ))}
                </div>
            </nav>

            {/* Refresh */}
            <button
                type="button"
                onClick={load}
                className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-ink-4 hover:text-accent border-t border-rule transition-colors duration-short ease-out flex items-center gap-1.5"
                title="Refresh session list"
                aria-label="Refresh sessions"
            >
                <span aria-hidden>↻</span> Refresh
            </button>
        </aside>
    );
}
