"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
}

interface ChatInterfaceProps {
    onNewWidget: (widgetData: any) => void;
}

export default function ChatInterface({ onNewWidget }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [availableModels, setAvailableModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<any>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await fetch('http://localhost:8261/api/models');
                if (res.ok) {
                    const data = await res.json();
                    setAvailableModels(data.models || []);
                    if (data.models && data.models.length > 0) {
                        setSelectedModel(data.models[0]); // Default to Gemini
                    }
                }
            } catch (error) {
                console.error("Failed to fetch models:", error);
            }
        };
        fetchModels();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');

        // Add user message to UI
        const newMsgId = Date.now().toString();
        setMessages(prev => [...prev, { id: newMsgId, role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const payload: any = { message: userMessage };
            if (sessionId) payload.session_id = sessionId;
            if (selectedModel) {
                payload.model_name = selectedModel.id;
                payload.provider = selectedModel.provider;
            }

            const res = await fetch('http://localhost:8261/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();

            if (!sessionId) setSessionId(data.session_id);

            // Parse response for widgets
            const rawContent = data.response;
            let finalContent = rawContent;

            // Look for ```widget blocks
            const widgetRegex = /```widget\n([\s\S]*?)```/g;
            let match;

            while ((match = widgetRegex.exec(rawContent)) !== null) {
                try {
                    const widgetJson = JSON.parse(match[1]);
                    onNewWidget(widgetJson);
                } catch (e) {
                    console.error("Failed to parse widget JSON:", e);
                }
            }

            // Clean up response string by removing the raw JSON blocks from UI
            finalContent = finalContent.replace(widgetRegex, '[Interactive Widget added to Board]');

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: finalContent
            }]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: 'Error: Failed to connect to backend server. Please make sure the FastAPI server is running.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h2 className="title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Financial Analyst AI
                </h2>

                {availableModels.length > 0 && (
                    <select
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--primary)',
                            border: '1px solid var(--panel-border)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            outline: 'none',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                        value={selectedModel?.id || ''}
                        onChange={(e) => {
                            const model = availableModels.find(m => m.id === e.target.value);
                            if (model) setSelectedModel(model);
                        }}
                    >
                        {availableModels.map(m => (
                            <option key={m.id} value={m.id} style={{ background: '#0d1117' }}>
                                {m.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.length === 0 && (
                    <div style={{ color: 'var(--foreground)', opacity: 0.6, fontStyle: 'italic', textAlign: 'center', margin: 'auto' }}>
                        Ask me to render a graph, analyze a company, or build a DCF model...
                    </div>
                )}

                {messages.map(msg => (
                    <div
                        key={msg.id}
                        style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                            color: msg.role === 'user' ? '#fff' : 'var(--foreground)',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            maxWidth: '85%',
                            border: msg.role === 'agent' ? '1px solid var(--panel-border)' : 'none',
                            lineHeight: '1.5',
                            whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
                            overflowWrap: 'anywhere'
                        }}
                    >
                        {msg.role === 'agent' ? (
                            <div className="markdown-body">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        ) : (
                            msg.content
                        )}
                    </div>
                ))}
                {loading && (
                    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: 'var(--accent)' }}>
                        <Loader2 className="animate-spin" size={18} />
                        <span style={{ fontSize: '0.9rem' }}>Analyzing data...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--panel-border)' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g., Draw an advanced stock graph of AAPL for the last 6 months..."
                    className="input"
                    disabled={loading}
                />
                <button type="submit" className="button" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}
