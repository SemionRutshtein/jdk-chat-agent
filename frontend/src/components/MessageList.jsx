import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import CitationBadge from './CitationBadge';

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    return (
        <button
            onClick={handleCopy}
            className="text-[11px] font-mono uppercase tracking-wider text-ink-4 hover:text-accent transition-colors duration-short ease-out px-1.5 py-1 rounded"
            title="Copy response"
        >
            {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
    );
}

function UserMessage({ content }) {
    return (
        <div className="flex justify-end mb-5 animate-fade-up">
            <div className="max-w-2xl bg-accent text-accent-ink rounded-card rounded-tr-sm px-4 py-3 shadow-[0_8px_24px_-8px_oklch(62%_0.22_25_/_0.45)]">
                <p className="text-sm whitespace-pre-wrap leading-relaxed font-medium">{content}</p>
            </div>
        </div>
    );
}

function StreamingCursor() {
    return (
        <span className="inline-block w-[2px] h-[1.05em] bg-accent ml-0.5 align-[-2px] animate-pulse" />
    );
}

function AssistantMessage({ content, citations, streaming }) {
    return (
        <div className="flex justify-start mb-5 animate-fade-up">
            <div className="max-w-3xl w-full">
                <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center text-[11px] font-bold text-accent-ink shadow-[0_4px_14px_-4px_oklch(62%_0.22_25_/_0.6)]">
                        J
                    </div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">
                        jdk · agent
                    </span>
                    {streaming && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-accent">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            streaming
                        </span>
                    )}
                </div>

                <div className="surface accent-bar px-5 py-4">
                    <div className="prose prose-invert prose-sm max-w-none
                        [&_h1]:text-ink [&_h1]:font-display [&_h1]:tracking-tight
                        [&_h2]:text-ink [&_h2]:font-display [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-5 [&_h2]:mb-2
                        [&_h3]:text-ink [&_h3]:font-display [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mt-4 [&_h3]:mb-2
                        [&_code]:text-accent-glow [&_code]:bg-paper [&_code]:border [&_code]:border-rule [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.825em] [&_code]:font-mono
                        [&_pre]:bg-paper [&_pre]:border [&_pre]:border-rule [&_pre]:rounded-input [&_pre]:p-3.5 [&_pre]:overflow-x-auto
                        [&_pre_code]:text-ink-2 [&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:p-0
                        [&_strong]:text-ink [&_strong]:font-semibold
                        [&_a]:text-accent [&_a]:no-underline [&_a]:border-b [&_a]:border-accent/40 hover:[&_a]:border-accent
                        [&_li]:text-ink-2 [&_li]:my-1 [&_p]:text-ink-2 [&_p]:leading-relaxed
                        [&_ul]:my-2.5 [&_ol]:my-2.5
                        [&_hr]:border-rule [&_hr]:my-4
                        [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:text-ink-3 [&_blockquote]:italic">
                        {content ? (
                            <>
                                <Markdown>{content}</Markdown>
                                {streaming && <StreamingCursor />}
                            </>
                        ) : streaming ? (
                            <div className="flex space-x-1.5 items-center h-5">
                                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                            </div>
                        ) : null}
                    </div>

                    {citations && citations.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-rule">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4 mb-2">
                                Sources
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {citations.map((c, i) => <CitationBadge key={i} citation={c} />)}
                            </div>
                        </div>
                    )}

                    {!streaming && content && (
                        <div className="flex justify-end mt-3 -mb-1">
                            <CopyButton text={content} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const STARTERS = [
    'What is a lambda expression?',
    'How does garbage collection work?',
    'Sealed classes in Java 17',
    'Virtual threads in Java 21',
    'Records vs classes',
    'JIT compilation explained',
];

export default function MessageList({ messages, loading, onPickStarter }) {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    return (
        <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto">
                {messages.length === 0 && !loading && (
                    <div className="mt-12 sm:mt-20 animate-fade-up">
                        <div className="inline-flex items-center gap-2 mb-5">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
                                Java · official specs
                            </span>
                        </div>
                        <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink leading-[1.1] tracking-tight mb-3">
                            What do you want to <span className="text-accent">understand</span>?
                        </h2>
                        <p className="text-sm text-ink-3 max-w-md mb-6">
                            Pick a starter or write your own. Answers are streamed and cite the JLS / JVM spec they came from.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {STARTERS.map(q => (
                                <button
                                    key={q}
                                    onClick={() => onPickStarter?.(q)}
                                    className="chip cursor-pointer hover:border-accent hover:text-ink"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) =>
                    msg.role === 'user'
                        ? <UserMessage key={i} content={msg.content} />
                        : <AssistantMessage key={i} content={msg.content} citations={msg.citations} streaming={msg.streaming} />
                )}

                {loading && messages.length === 0 && (
                    <div className="flex justify-center mt-8">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-4 animate-pulse">
                            Loading history…
                        </span>
                    </div>
                )}

                <div ref={endRef} />
            </div>
        </div>
    );
}
