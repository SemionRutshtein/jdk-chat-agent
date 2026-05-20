import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import CitationBadge from './CitationBadge';

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button
            onClick={handleCopy}
            className="text-xs text-gray-500 hover:text-gray-300 transition px-1 py-0.5 rounded hover:bg-gray-700"
            title="Copy response"
        >
            {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
    );
}

function UserMessage({ content }) {
    return (
        <div className="flex justify-end mb-4">
            <div className="max-w-2xl bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-3">
                <p className="text-sm text-white whitespace-pre-wrap">{content}</p>
            </div>
        </div>
    );
}

function StreamingCursor() {
    return (
        <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 align-middle animate-pulse" />
    );
}

function AssistantMessage({ content, citations, streaming }) {
    return (
        <div className="flex justify-start mb-4">
            <div className="max-w-3xl w-full">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">J</div>
                    <span className="text-xs text-gray-500">Java Docs Assistant</span>
                    {streaming && <span className="text-xs text-blue-400 animate-pulse">● streaming</span>}
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="prose prose-invert prose-sm max-w-none
                        [&_h2]:text-gray-100 [&_h3]:text-gray-100 [&_h2]:font-semibold [&_h3]:font-semibold
                        [&_code]:text-blue-300 [&_code]:bg-gray-900 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs
                        [&_pre]:bg-gray-900 [&_pre]:border [&_pre]:border-gray-700 [&_pre]:rounded [&_pre]:p-3
                        [&_strong]:text-gray-100 [&_a]:text-blue-400
                        [&_li]:text-gray-200 [&_p]:text-gray-200 [&_p]:leading-relaxed
                        [&_hr]:border-gray-700">
                        {content ? (
                            <>
                                <Markdown>{content}</Markdown>
                                {streaming && <StreamingCursor />}
                            </>
                        ) : streaming ? (
                            <div className="flex space-x-1.5 items-center h-5">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                            </div>
                        ) : null}
                    </div>

                    {citations && citations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                            <p className="text-xs text-gray-500 mb-1.5">Sources</p>
                            <div className="flex flex-wrap gap-1.5">
                                {citations.map((c, i) => <CitationBadge key={i} citation={c} />)}
                            </div>
                        </div>
                    )}

                    {!streaming && (
                        <div className="flex justify-end mt-2">
                            <CopyButton text={content} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MessageList({ messages, loading }) {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    return (
        <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-3xl mx-auto">
                {messages.length === 0 && !loading && (
                    <div className="text-center mt-20">
                        <div className="text-4xl mb-3">☕</div>
                        <p className="text-gray-400 text-lg font-medium">Ask anything about Java</p>
                        <p className="text-gray-600 text-sm mt-1">Answers sourced from official Oracle specs</p>
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                            {[
                                'What is a lambda expression?',
                                'How does garbage collection work?',
                                'What are sealed classes in Java 17?',
                                'Explain virtual threads in Java 21',
                            ].map(q => (
                                <span key={q} className="text-xs bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5 text-gray-400">
                                    {q}
                                </span>
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
                        <span className="text-xs text-gray-500 animate-pulse">Loading history…</span>
                    </div>
                )}

                <div ref={endRef} />
            </div>
        </div>
    );
}
