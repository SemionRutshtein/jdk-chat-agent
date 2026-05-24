import React, { useState, useRef, useEffect } from 'react';

const MAX_CHARS = 2000;

export default function MessageInput({ onSend, disabled }) {
    const [input, setInput] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (!disabled) textareaRef.current?.focus();
    }, [disabled]);

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
        if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            submit();
        }
    };

    const charsLeft = MAX_CHARS - input.length;
    const overLimit = charsLeft < 0;
    const nearLimit = charsLeft < 100 && !overLimit;

    return (
        <div className="border-t border-rule bg-paper-2/70 backdrop-blur-sm px-3 sm:px-4 pt-3 flex-shrink-0 pb-safe" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="max-w-3xl mx-auto">
                <div className={`flex items-end gap-2 bg-paper-3 border rounded-card px-3 py-2.5 transition-colors duration-short ease-out ${
                    overLimit
                        ? 'border-accent'
                        : 'border-rule focus-within:border-accent-soft focus-within:bg-paper-2'
                }`}>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about Java…"
                        disabled={disabled}
                        rows={1}
                        aria-label="Chat message"
                        className="flex-1 bg-transparent text-ink placeholder-ink-4 text-sm resize-none focus:outline-none disabled:opacity-50 leading-relaxed"
                        style={{ minHeight: '24px' }}
                    />
                    <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
                        {input.length > 0 && (
                            <span
                                className={`hidden sm:inline text-[11px] font-mono tabular-nums ${
                                    overLimit ? 'text-accent' : nearLimit ? 'text-warn' : 'text-ink-4'
                                }`}
                                aria-live="polite"
                            >
                                {charsLeft}
                            </span>
                        )}
                        {/* Mobile char counter (compact) */}
                        {input.length > 0 && (overLimit || nearLimit) && (
                            <span
                                className={`sm:hidden text-[11px] font-mono tabular-nums ${
                                    overLimit ? 'text-accent' : 'text-warn'
                                }`}
                                aria-live="polite"
                            >
                                {charsLeft}
                            </span>
                        )}
                        {/* Send button — 44px min touch target on mobile */}
                        <button
                            type="button"
                            onClick={submit}
                            disabled={disabled || !input.trim() || overLimit}
                            className="btn-primary text-xs px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5"
                            title="Send (Enter)"
                            aria-label="Send message"
                        >
                            {disabled ? (
                                <span
                                    className="inline-block w-3 h-3 border-2 border-accent-ink/40 border-t-accent-ink rounded-full animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <>
                                    Send <span aria-hidden className="hidden sm:inline">↵</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
                {/* Keyboard hint — desktop only */}
                <p className="hidden sm:block text-[11px] text-ink-4 mt-1.5 text-right font-mono tracking-wide">
                    <kbd className="px-1 py-0.5 bg-paper-3 border border-rule rounded text-[10px]">↵</kbd> send · <kbd className="px-1 py-0.5 bg-paper-3 border border-rule rounded text-[10px]">⇧↵</kbd> newline
                </p>
            </div>
        </div>
    );
}
