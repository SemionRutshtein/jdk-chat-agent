import React, { useState } from 'react';
import { chatAPI } from '../api/client';

export default function LoginPage({ onAuth }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = mode === 'login'
                ? await chatAPI.login(email, password)
                : await chatAPI.register(email, password);

            const { access_token, email: userEmail, user_id } = res.data;
            localStorage.setItem('jdk_chat_token', access_token);
            localStorage.setItem('jdk_chat_user', JSON.stringify({ email: userEmail, user_id }));
            onAuth({ email: userEmail, user_id });
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(detail || 'Something went wrong. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="text-5xl mb-3">☕</div>
                    <h1 className="text-2xl font-bold text-white">Java Docs Assistant</h1>
                    <p className="text-gray-400 text-sm mt-1">Powered by Oracle official specs</p>
                </div>

                {/* Card */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                    {/* Tab switcher */}
                    <div className="flex bg-gray-900 rounded-lg p-1 mb-6">
                        {['login', 'register'].map((m) => (
                            <button
                                key={m}
                                onClick={() => { setMode(m); setError(''); }}
                                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition ${
                                    mode === m
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                {m === 'login' ? 'Sign in' : 'Register'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                                placeholder="Min 6 characters"
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        {error && (
                            <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-2 rounded-lg text-sm transition"
                        >
                            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
