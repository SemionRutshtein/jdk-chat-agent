import React, { useEffect, useState } from 'react';
import { chatAPI } from '../api/client';

const VERSION_CHIP = {
    '8':  { ring: 'border-accent-soft', dot: 'bg-accent-deep', label: 'text-ink-2' },
    '17': { ring: 'border-rule-2',      dot: 'bg-ink-3',       label: 'text-ink-2' },
    '21': { ring: 'border-accent',      dot: 'bg-accent',      label: 'text-ink' },
};

function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SessionSidebar({ currentSessionId, onSelectSession, onNewSession }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await chatAPI.getSessions(30);
            setSessions(res.data.sessions || []);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [currentSessionId]);

    return (
        <aside className="w-64 flex-shrink-0 bg-paper-2/60 backdrop-blur-sm border-r border-rule flex flex-col h-full">
            {/* Wordmark */}
            <div className="px-4 py-4 border-b border-rule flex items-center gap-2">
                <span className="wordmark-dot" />
                <span className="font-display font-semibold text-sm tracking-tight text-ink">jdk · agent</span>
            </div>

            {/* New chat */}
            <div className="p-3">
                <button
                    onClick={onNewSession}
                    className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
                    title="New chat session"
                >
                    <span className="text-base leading-none">+</span> New chat
                </button>
            </div>

            {/* Section label */}
            <div className="px-4 pb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">
                    Recent
                </span>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {loading && (
                    <div className="px-3 py-2 text-xs text-ink-4">Loading…</div>
                )}
                {!loading && sessions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-ink-4">No sessions yet</div>
                )}
                {sessions.map(s => {
                    const isActive = s.session_id === currentSessionId;
                    const v = VERSION_CHIP[s.last_java_version] || { ring: 'border-rule', dot: 'bg-ink-4', label: 'text-ink-3' };
                    return (
                        <button
                            key={s.session_id}
                            onClick={() => onSelectSession(s.session_id)}
                            className={`group w-full text-left px-3 py-2 rounded-input relative transition-colors duration-short ease-out ${
                                isActive
                                    ? 'bg-paper-3 text-ink accent-bar'
                                    : 'text-ink-3 hover:bg-paper-3/60 hover:text-ink-2'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-mono truncate max-w-[8rem]">
                                    {s.session_id.slice(0, 12)}…
                                </span>
                                {s.last_java_version && (
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-pill border ${v.ring} ${v.label}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                                        J{s.last_java_version}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-ink-4">
                                <span>{s.message_count} msg{s.message_count === 1 ? '' : 's'}</span>
                                <span>{formatDate(s.updated_at)}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Refresh */}
            <button
                onClick={load}
                className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-ink-4 hover:text-accent border-t border-rule transition-colors duration-short ease-out flex items-center gap-1.5"
                title="Refresh session list"
            >
                <span>↻</span> Refresh
            </button>
        </aside>
    );
}
