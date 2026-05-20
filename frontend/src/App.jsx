import React, { useState, useEffect } from 'react';
import Chat from './components/Chat';
import LoginPage from './components/LoginPage';

function loadUser() {
    try {
        const token = localStorage.getItem('jdk_chat_token');
        const raw = localStorage.getItem('jdk_chat_user');
        if (token && raw) return JSON.parse(raw);
    } catch {}
    return null;
}

export default function App() {
    const [user, setUser] = useState(() => loadUser());

    // Listen for 401 → logout anywhere in the app
    useEffect(() => {
        const logout = () => setUser(null);
        window.addEventListener('auth:logout', logout);
        return () => window.removeEventListener('auth:logout', logout);
    }, []);

    const handleAuth = (userData) => setUser(userData);

    const handleLogout = () => {
        localStorage.removeItem('jdk_chat_token');
        localStorage.removeItem('jdk_chat_user');
        localStorage.removeItem('jdk_chat_session_id');
        setUser(null);
    };

    if (!user) return <LoginPage onAuth={handleAuth} />;
    return <Chat user={user} onLogout={handleLogout} />;
}
