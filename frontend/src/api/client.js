import axios from 'axios';

// Runtime injection (Railway) takes precedence over build-time env var
const API_URL = window.__API_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
client.interceptors.request.use((config) => {
    const token = localStorage.getItem('jdk_chat_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// On 401 — clear token so App re-renders to login
client.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('jdk_chat_token');
            localStorage.removeItem('jdk_chat_user');
            window.dispatchEvent(new Event('auth:logout'));
        }
        return Promise.reject(err);
    }
);

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
            const token = localStorage.getItem('jdk_chat_token');
            const res = await fetch(`${API_URL}/api/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
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

    register: (email, password) =>
        client.post('/api/auth/register', { email, password }),

    login: (email, password) =>
        client.post('/api/auth/login', { email, password }),
};

export default client;
