import React, { useState } from 'react';
import { chatAPI } from '../api/client';

export default function LoginPage({ onAuth }) {
    const [mode, setMode] = useState('login');
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
        <div className="min-h-screen flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md">
                {/* Wordmark */}
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center gap-2 mb-5">
                        <span className="wordmark-dot" />
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
                            jdk · agent
                        </span>
                    </div>
                    <h1 className="font-display text-4xl sm:text-[2.75rem] font-semibold text-ink leading-[1.05] tracking-tight">
                        Ask the <span className="text-accent">Java specs</span><br/>
                        anything.
                    </h1>
                    <p className="mt-3 text-sm text-ink-3 max-w-sm mx-auto">
                        Answers grounded in the official JLS and JVM specs. Cited, streamed, fast.
                    </p>
                </div>

                {/* Card */}
                <div className="surface p-6 sm:p-7 shadow-[0_30px_80px_-20px_oklch(0%_0_0_/_0.6)]">
                    {/* Tab switcher */}
                    <div className="flex gap-1 mb-6 p-1 bg-paper-3 rounded-input border border-rule">
                        {[
                            { k: 'login', label: 'Sign in' },
                            { k: 'register', label: 'Register' },
                        ].map(({ k, label }) => (
                            <button
                                key={k}
                                onClick={() => { setMode(k); setError(''); }}
                                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors duration-short ease-out ${
                                    mode === k
                                        ? 'bg-accent text-accent-ink shadow-[0_4px_14px_-4px_oklch(62%_0.22_25_/_0.6)]'
                                        : 'text-ink-3 hover:text-ink'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider font-medium text-ink-3 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="input-base w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider font-medium text-ink-3 mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                                placeholder="Min 6 characters"
                                className="input-base w-full"
                            />
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 text-xs text-accent bg-accent/[0.06] border border-accent-soft/40 rounded-input px-3 py-2 animate-fade-up">
                                <span className="mt-0.5">⚠</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-2.5 text-sm"
                        >
                            {loading ? 'One moment…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
                        </button>
                    </form>

                    <p className="mt-5 text-[11px] text-ink-4 text-center">
                        By continuing you accept the project's terms of use.
                    </p>
                </div>

                <p className="mt-6 text-center text-[11px] font-mono text-ink-4 tracking-wider">
                    SOURCES — JLS · JVMS · JAVA 8 / 17 / 21
                </p>
            </div>
        </div>
    );
}
