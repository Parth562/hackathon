"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Paperclip } from 'lucide-react';
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [availableModels, setAvailableModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
    const [statusMessage, setStatusMessage] = useState<string>("Thinking...");

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('http://localhost:8261/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Failed to upload file');

            const data = await res.json();

            setUploadedDocs(prev => {
                if (!prev.includes(file.name)) {
                    return [...prev, file.name];
                }
                return prev;
            });

            // Add system message to UI confirming upload
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'agent',
                content: `✅ Successfully uploaded and processed document: **${file.name}**. You can now ask me questions about it!`
            }]);
        } catch (error) {
            console.error('Error uploading file:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'agent',
                content: `❌ Error uploading ${file.name}. Please ensure the backend is running.`
            }]);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

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

        const fetchDocuments = async () => {
            try {
                const res = await fetch('http://localhost:8261/api/documents');
                if (res.ok) {
                    const data = await res.json();
                    setUploadedDocs(data.documents || []);
                }
            } catch (error) {
                console.error("Failed to fetch documents:", error);
            }
        };

        fetchModels();
        fetchDocuments();
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
        setStatusMessage("Starting agent...");

        try {
            const payload: any = { message: userMessage };
            if (sessionId) payload.session_id = sessionId;
            if (selectedModel) {
                payload.model_name = selectedModel.id;
                payload.provider = selectedModel.provider;
            }

            const response = await fetch('http://localhost:8261/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Network response was not ok');
            
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            
            if (!reader) throw new Error("No reader available");

            let finalContent = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Process all complete lines
                buffer = lines.pop() || ""; // Keep the last incomplete line in buffer
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        
                        if (data.type === 'status') {
                            setStatusMessage(data.content);
                        } else if (data.type === 'result') {
                            finalContent = data.response;
                            if (data.session_id) setSessionId(data.session_id);
                        } else if (data.type === 'error') {
                            console.error("Agent Error:", data.content);
                            finalContent = "⚠️ Error: " + data.content;
                        }
                    } catch (e) {
                         console.error("Error parsing JSON line", e);
                    }
                }
            }

            // Parse finalContent for widgets (same logic as before)
            const rawContent = finalContent;
            
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

    const [activeTab, setActiveTab] = useState<'chat' | 'library'>('chat');
    const [searchQuery, setSearchQuery] = useState('');

    const handleDeleteDoc = async (docName: string) => {
         if (!confirm(`Are you sure you want to delete ${docName}?`)) return;
         try {
             await fetch(`http://localhost:8261/api/documents/${docName}`, { method: 'DELETE' });
             setUploadedDocs(prev => prev.filter(d => d !== docName));
         } catch (e) { console.error(e); }
    };

    const handleManualSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setStatusMessage("Searching documents...");
        try {
            const res = await fetch('http://localhost:8261/api/documents/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery, limit: 3 })
            });
            const data = await res.json();
            
            // Inject results into chat
            const resultsFormatted = data.results.map((r: any, i: number) => 
                `**Result ${i+1}** (${r.source}, Score: ${(r.score*100).toFixed(0)}%)\n> "${r.text.substring(0, 200)}..."`
            ).join('\n\n');
            
            setMessages(prev => [
                ...prev,
                { id: Date.now().toString(), role: 'user', content: `Search for: "${searchQuery}"` },
                { id: (Date.now()+1).toString(), role: 'agent', content: resultsFormatted ? `Found these matches:\n\n${resultsFormatted}` : "No matches found." }
            ]);
            setActiveTab('chat');
            setSearchQuery('');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h2 className="title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Financial Analyst AI
                </h2>

                <div style={{ display: 'flex', gap: '8px' }}>
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
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginBottom: '16px' }}>
                <button
                    onClick={() => setActiveTab('chat')}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: activeTab === 'chat' ? 'var(--primary)' : 'var(--foreground)',
                        fontSize: '0.9rem',
                        fontWeight: activeTab === 'chat' ? 600 : 400,
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderBottom: activeTab === 'chat' ? '2px solid var(--primary)' : '2px solid transparent'
                    }}
                >
                    Chat
                </button>
                <button
                    onClick={() => setActiveTab('library')}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: activeTab === 'library' ? 'var(--primary)' : 'var(--foreground)',
                        fontSize: '0.9rem',
                        fontWeight: activeTab === 'library' ? 600 : 400,
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderBottom: activeTab === 'library' ? '2px solid var(--primary)' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    Document Library {uploadedDocs.length > 0 && <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '12px', padding: '2px 6px', fontSize: '0.7rem' }}>{uploadedDocs.length}</span>}
                </button>
            </div>

            {/* Views Setup */}
            {activeTab === 'library' ? (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px dashed var(--panel-border)' }}>
                        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--foreground)' }}>Knowledge Base</h3>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => { handleFileUpload(e); setActiveTab('chat'); }}
                                style={{ display: 'none' }}
                                accept=".pdf,.txt"
                            />
                            <button
                                className="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.85rem' }}
                            >
                                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                                Add Document
                            </button>
                        </div>

                        <div className="search-bar" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                            <input 
                                type="text" 
                                placeholder="Search all documents..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ 
                                    flex: 1, 
                                    padding: '8px 12px', 
                                    borderRadius: '8px', 
                                    border: '1px solid var(--panel-border)', 
                                    background: 'rgba(0,0,0,0.2)', 
                                    color: '#fff' 
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                            />
                            <button 
                                onClick={handleManualSearch}
                                style={{ 
                                    padding: '8px 12px', 
                                    borderRadius: '8px', 
                                    border: '1px solid var(--panel-border)', 
                                    background: 'var(--primary)', 
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                Search
                            </button>
                        </div>

                        {uploadedDocs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0', opacity: 0.6 }}>
                                No documents uploaded yet. Add company SEC filings, internal memos, or strategy docs to provide the AI with context.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {uploadedDocs.map((doc, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}>
                                        <Paperclip size={18} style={{ color: 'var(--primary)' }} />
                                        <div style={{ flex: 1, fontSize: '0.9rem', color: 'var(--foreground)' }}>{doc}</div>
                                        <button 
                                            onClick={() => handleDeleteDoc(doc)}
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                color: '#f85149', 
                                                cursor: 'pointer',
                                                padding: '4px',
                                                borderRadius: '4px',
                                                opacity: 0.7
                                            }}
                                            title="Delete Document"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
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
                                <span style={{ fontSize: '0.9rem' }}>{statusMessage}</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--panel-border)' }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => handleFileUpload(e)}
                            style={{ display: 'none' }}
                            accept=".pdf,.txt"
                        />
                        <button
                            type="button"
                            className="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading || uploading}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--foreground)' }}
                            title="Upload Company Document"
                        >
                            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                        </button>
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
                </>
            )}
        </div>
    );
}
