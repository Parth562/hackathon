"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal, Code, CheckCircle2, XCircle, RefreshCw, Play } from 'lucide-react';

interface SandboxWidgetProps {
    id: string;
    data: {
        widgetData: {
            code?: string;
            inputs?: Record<string, any>;
            [key: string]: any;
        };
        outputData?: any;
    };
    onOutputChange?: (updates: Record<string, any>) => void;
    onClose?: (e: React.MouseEvent) => void;
}

export default function SandboxWidget({ id, data, onOutputChange, onClose }: SandboxWidgetProps) {
    const { code = 'print("Hello world")', inputs = {} } = data.widgetData || {};

    // We maintain internal state for output and status, but also push to parent for piping
    const [output, setOutput] = useState<string>(data.widgetData?.output || 'Executing...');
    const [status, setStatus] = useState<string>(data.widgetData?.status || 'idle');
    const [executing, setExecuting] = useState(false);
    const [view, setView] = useState<'output' | 'code' | 'split'>('output');

    // Extract named inputs (a, b, c, d) from widgetData
    const currentInputs = {
        a: data.widgetData?.a,
        b: data.widgetData?.b,
        c: data.widgetData?.c,
        d: data.widgetData?.d,
    };

    const runExecution = useCallback(async () => {
        setExecuting(true);
        try {
            const response = await fetch('http://localhost:8261/api/sandbox/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    inputs: currentInputs
                }),
            });

            const result = await response.json();

            let finalOutput = result.stdout;
            if (result.stderr) finalOutput += `\n[ERR]\n${result.stderr}`;

            setOutput(finalOutput || (result.status === 'success' ? 'Success (no output)' : 'Error'));
            setStatus(result.status);

            // PIPE the result to the next node
            if (onOutputChange) {
                const payload: Record<string, any> = {
                    'out-result': result.result ?? result.stdout.trim()
                };

                // If python returned a JSON dictionary, map out-a, b, c, d
                if (result.result && typeof result.result === 'object' && !Array.isArray(result.result)) {
                    ['out-a', 'out-b', 'out-c', 'out-d'].forEach(key => {
                        if (result.result[key] !== undefined) {
                            payload[key] = result.result[key];
                        }
                    });
                }

                onOutputChange(payload);
            }
        } catch (err) {
            console.error("Sandbox Execution Failed", err);
            setStatus('error');
            setOutput("Network error connecting to sandbox backend.");
        } finally {
            setExecuting(false);
        }
    }, [code, currentInputs.a, currentInputs.b, currentInputs.c, currentInputs.d, onOutputChange]);

    // Reactive Trigger: Run when inputs OR code changes
    const lastTriggerRef = useRef("");
    useEffect(() => {
        const triggerKey = JSON.stringify({ code, ...currentInputs });
        if (triggerKey !== lastTriggerRef.current) {
            lastTriggerRef.current = triggerKey;
            runExecution();
        }
    }, [runExecution, code, currentInputs]);

    const statusColor = status === 'success' ? '#3fb950' : status === 'idle' ? 'var(--text-muted)' : '#f85149';
    const StatusIcon = status === 'success' ? CheckCircle2 : status === 'idle' ? RefreshCw : XCircle;

    return (
        <div className="glass-panel" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div className="drag-handle" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', background: 'rgba(255,255,255,0.03)', cursor: 'grab' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Terminal size={14} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Python Sandbox</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <button onClick={() => setView('output')} style={{ background: view === 'output' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: view === 'output' ? '#fff' : '#8b949e', padding: '2px 8px', fontSize: '0.65rem', cursor: 'pointer' }}>Output</button>
                        <button onClick={() => setView('code')} style={{ background: view === 'code' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderLeft: '1px solid var(--border-subtle)', color: view === 'code' ? '#fff' : '#8b949e', padding: '2px 8px', fontSize: '0.65rem', cursor: 'pointer' }}>Code</button>
                        <button onClick={() => setView('split')} style={{ background: view === 'split' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderLeft: '1px solid var(--border-subtle)', color: view === 'split' ? '#fff' : '#8b949e', padding: '2px 8px', fontSize: '0.65rem', cursor: 'pointer' }}>Split</button>
                    </div>

                    <button
                        onClick={runExecution}
                        disabled={executing}
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-secondary)', padding: '2px 6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    >
                        {executing ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    </button>
                    {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '14px' }}>✕</button>}
                </div>
            </div>

            {/* Content Body */}
            <div style={{ display: 'flex', flexDirection: view === 'split' ? 'column' : 'row', flex: 1, minHeight: 0 }}>

                {/* Code Window */}
                {(view === 'code' || view === 'split') && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderBottom: view === 'split' ? '1px solid var(--border-subtle)' : 'none' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '4px 14px', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Code size={10} /> script.py
                        </div>
                        <pre style={{ margin: 0, padding: '10px 14px', flex: 1, background: '#0d1117', color: '#8b949e', fontSize: '0.75rem', fontFamily: 'monospace', overflow: 'auto' }}>
                            <code>{code}</code>
                        </pre>
                    </div>
                )}

                {/* Output Window */}
                {(view === 'output' || view === 'split') && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '4px 14px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Terminal Output</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <StatusIcon size={10} color={statusColor} />
                                <span style={{ color: statusColor }}>{status}</span>
                            </div>
                        </div>
                        <pre style={{
                            margin: 0,
                            padding: '10px 14px',
                            flex: 1,
                            background: '#010409',
                            color: status === 'error' ? '#ff7b72' : '#c9d1d9',
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {output}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
