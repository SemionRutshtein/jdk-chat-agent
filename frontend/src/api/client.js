import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

export const chatAPI = {
    sendMessage: (sessionId, message, javaVersion) =>
        client.post('/api/chat', { session_id: sessionId, message, java_version: javaVersion }),

    /**
     * Stream a chat response via SSE.
     * Returns an object with an async iterator and an abort() method.
     *
     * Events yielded: { type: 'token', text } | { type: 'citations', citations } | { type: 'done' } | { type: 'error', message }
     */
    streamMessage: (sessionId, message, javaVersion) => {
        const controller = new AbortController();

        async function* events() {
            const res = await fetch(`${API_URL}/api/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, message, java_version: javaVersion }),
                signal: controller.signal,
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop(); // keep incomplete last line
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            yield JSON.parse(line.slice(6));
                        } catch { /* skip malformed */ }
                    }
                }
            }
        }

        return { events, abort: () => controller.abort() };
    },

    getHistory: (sessionId) =>
        client.get(`/api/history/${sessionId}`),

    getSessions: (limit = 20) =>
        client.get(`/api/sessions?limit=${limit}`),

    getVersions: () =>
        client.get('/api/versions'),

    health: () =>
        client.get('/api/health'),
};

export default client;
