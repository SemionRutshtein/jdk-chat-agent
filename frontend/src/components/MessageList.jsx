import React, { useEffect, useRef } from 'react';
import CitationBadge from './CitationBadge';

export default function MessageList({ messages, loading }) {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="max-w-4xl mx-auto">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-8">
                        <p className="text-lg">Ask me anything about Java documentation!</p>
                        <p className="text-sm mt-2">Select a version above to get started.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-2xl ${
                                msg.role === 'user'
                                    ? 'bg-blue-600 rounded-lg p-3'
                                    : 'bg-gray-800 rounded-lg p-3 border border-gray-700'
                            }`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                {msg.citations && msg.citations.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {msg.citations.map((citation, i) => (
                                            <CitationBadge key={i} citation={citation} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                            <div className="flex space-x-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
}
