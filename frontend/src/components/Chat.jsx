import React, { useState, useEffect } from 'react';
import { chatAPI } from '../api/client';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VersionSelector from './VersionSelector';

export default function Chat() {
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [javaVersion, setJavaVersion] = useState('8');
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState(['5', '8', '17', '21']);

    useEffect(() => {
        chatAPI.getVersions().then(res => {
            setVersions(res.data.versions);
            setJavaVersion(res.data.default);
        }).catch(err => console.error('Failed to load versions:', err));
    }, []);

    useEffect(() => {
        setSessionId('session-' + Date.now());
    }, []);

    useEffect(() => {
        if (sessionId && messages.length === 0) {
            chatAPI.getHistory(sessionId).then(res => {
                setMessages(res.data.messages);
            }).catch(() => {
                console.log('New session started');
            });
        }
    }, [sessionId]);

    const handleSendMessage = async (message) => {
        if (!message.trim() || !sessionId) return;

        setMessages(prev => [...prev, {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        }]);

        setLoading(true);

        try {
            const res = await chatAPI.sendMessage(sessionId, message, javaVersion);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: res.data.response,
                citations: res.data.citations,
                timestamp: res.data.timestamp
            }]);
        } catch (err) {
            console.error('Error sending message:', err);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Error: Failed to get response. Please try again.',
                citations: [],
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
            <div className="bg-gray-800 border-b border-gray-700 p-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Java Documentation Assistant</h1>
                    <VersionSelector versions={versions} current={javaVersion} onChange={setJavaVersion} />
                </div>
            </div>
            <MessageList messages={messages} loading={loading} />
            <MessageInput onSend={handleSendMessage} disabled={loading} />
        </div>
    );
}
