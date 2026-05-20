import React, { useState, useRef, useEffect } from 'react';

const MAX_CHARS = 2000;

export default function MessageInput({ onSend, disabled }) {
    const [input, setInput] = useState('');
    const textareaRef = useRef(null);

    // auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 180) + 'px';
    }, [input]);

    const submit = () => {
        const trimmed = input.trim();
        if (!trimmed || disabled || trimmed.length > MAX_CHARS) return;
        onSend(trimmed);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
        }
        // plain Enter sends too (Shift+Enter = newline)
        if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            submit();
        }
    };

    const charsLeft = MAX_CHARS - input.length;
    const overLimit = charsLeft < 0;
    const nearLimit = charsLeft < 100 && !overLimit;

    return (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-3 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
                <div className={`flex items-end gap-2 bg-gray-700 border rounded-xl px-3 py-2 transition ${
                    overLimit ? 'border-red-500' : 'border-gray-600 focus-within:border-blue-500'
                }`}>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about Java… (Enter to send, Shift+Enter for newline)"
                        disabled={disabled}
                        rows={1}
                        className="flex-1 bg-transparent text-white placeholder-gray-400 text-sm resize-none focus:outline-none disabled:opacity-50 leading-relaxed"
                        style={{ minHeight: '24px' }}
                    />
                    <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
                        {input.length > 0 && (
                            <span className={`text-xs ${overLimit ? 'text-red-400' : nearLimit ? 'text-yellow-400' : 'text-gray-500'}`}>
                                {charsLeft}
                            </span>
                        )}
                        <button
                            onClick={submit}
                            disabled={disabled || !input.trim() || overLimit}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                            {disabled ? '…' : '↑ Send'}
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-600 mt-1 text-right">⌘↵ or Enter to send · Shift+↵ for new line</p>
            </div>
        </div>
    );
}
