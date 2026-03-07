"use client";

import React, { useState } from 'react';
import { Terminal, Code, CheckCircle2, XCircle } from 'lucide-react';

interface SandboxWidgetProps {
    data: {
        code?: string;
        output?: string;
        status?: string;
    };
    onClose?: (e: React.MouseEvent) => void;
    onOpenSettings?: () => void;
}

export default function SandboxWidget({ data, onClose, onOpenSettings }: SandboxWidgetProps) {
    const code = data.code || 'print("Hello from Sandbox")';
    const output = data.output || 'Hello from Sandbox';
    const status = data.status || 'success';

    const [view, setView] = useState<'split' | 'code' | 'output'>('split');

    const statusColor = status === 'success' ? '#3fb950' : '#f85149';
    const StatusIcon = status === 'success' ? CheckCircle2 : XCircle;

    return (
        <div className="glass-panel" style={{ width: '450px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div className="drag-handle" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', background: 'rgba(255,255,255,0.03)', cursor: 'grab' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                    <Terminal size={16} style={{ color: "var(--accent)" }} />
                    Python Sandbox Environment
                </h3>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setView('split'); }}
                            style={{ background: view === 'split' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: view === 'split' ? '#fff' : '#8b949e', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer' }}
                        >Split</button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setView('code'); }}
                            style={{ background: view === 'code' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderLeft: '1px solid var(--border-subtle)', color: view === 'code' ? '#fff' : '#8b949e', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer' }}
                        >Code</button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setView('output'); }}
                            style={{ background: view === 'output' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderLeft: '1px solid var(--border-subtle)', color: view === 'output' ? '#fff' : '#8b949e', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer' }}
                        >Output</button>
                    </div>

                    {onOpenSettings && (
                        <button onClick={onOpenSettings} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <SettingsIcon size={14} />
                        </button>
                    )}
                    {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '16px' }}>✕</button>}
                </div>
            </div>

            {/* Execution Status Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '0.75rem', background: `rgba(${status === 'success' ? '63, 185, 80' : '248, 81, 73'}, 0.05)`, borderBottom: '1px solid var(--panel-border)' }}>
                <StatusIcon size={12} color={statusColor} />
                <span style={{ color: statusColor, fontWeight: 500 }}>
                    {status === 'success' ? 'Execution Completed' : 'Execution Failed'}
                </span>
            </div>

            {/* Body */}
            <div style={{ display: 'flex', flexDirection: view === 'split' ? 'column' : 'row', flex: 1, minHeight: '250px' }}>

                {/* Code Window */}
                {(view === 'split' || view === 'code') && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: view === 'split' ? '1px solid var(--panel-border)' : 'none' }}>
                        <div style={{ fontSize: '0.7rem', color: '#8b949e', padding: '6px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Code size={12} /> execution_script.py
                        </div>
                        <pre style={{
                            margin: 0,
                            padding: '12px 16px',
                            flex: 1,
                            background: '#0d1117',
                            color: '#e6edf3',
                            fontSize: '0.8rem',
                            fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                            overflowY: 'auto',
                            overflowX: 'auto',
                            display: 'block'
                        }}>
                            <code>{code}</code>
                        </pre>
                    </div>
                )}

                {/* Output Terminal */}
                {(view === 'split' || view === 'output') && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.7rem', color: '#8b949e', padding: '6px 16px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            Terminal Output
                        </div>
                        <pre style={{
                            margin: 0,
                            padding: '12px 16px',
                            flex: 1,
                            background: '#010409',
                            color: status === 'success' ? '#c9d1d9' : '#ff7b72',
                            fontSize: '0.8rem',
                            fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            display: 'block'
                        }}>
                            {output}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

const SettingsIcon = ({ size }: { size: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
