import React, { useEffect, useState } from 'react';
import { chatAPI } from '../api/client';

const VERSION_COLORS = {
    '8':  'bg-amber-700 text-amber-100',
    '17': 'bg-blue-700 text-blue-100',
    '21': 'bg-emerald-700 text-emerald-100',
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
            // backend unreachable — silent fail
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [currentSessionId]);

    return (
        <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sessions</span>
                <button
                    onClick={onNewSession}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition"
                    title="New chat session"
                >
                    + New
                </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <div className="p-3 text-xs text-gray-500">Loading…</div>
                )}
                {!loading && sessions.length === 0 && (
                    <div className="p-3 text-xs text-gray-500">No sessions yet</div>
                )}
                {sessions.map(s => {
                    const isActive = s.session_id === currentSessionId;
                    const vColor = VERSION_COLORS[s.last_java_version] || 'bg-gray-700 text-gray-200';
                    return (
                        <button
                            key={s.session_id}
                            onClick={() => onSelectSession(s.session_id)}
                            className={`w-full text-left p-3 border-b border-gray-800 hover:bg-gray-800 transition ${isActive ? 'bg-gray-800 border-l-2 border-l-blue-500' : ''}`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-300 font-mono truncate w-28">
                                    {s.session_id.slice(0, 8)}…
                                </span>
                                {s.last_java_version && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${vColor}`}>
                                        Java {s.last_java_version}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">{s.message_count} msgs</span>
                                <span className="text-xs text-gray-600">{formatDate(s.updated_at)}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Refresh */}
            <button
                onClick={load}
                className="p-2 text-xs text-gray-600 hover:text-gray-400 border-t border-gray-800 transition"
            >
                ↻ Refresh
            </button>
        </div>
    );
}
