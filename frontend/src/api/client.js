import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

export const chatAPI = {
    sendMessage: (sessionId, message, javaVersion) =>
        client.post('/api/chat', { session_id: sessionId, message, java_version: javaVersion }),

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
