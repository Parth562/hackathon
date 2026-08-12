"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { GitBranch } from 'lucide-react';

interface ConditionalWidgetProps {
    data: {
        comparator?: string;
        a?: any;
        b?: any;
    };
    onClose?: (e: React.MouseEvent) => void;
    onOutputChange?: (updates: Record<string, any>) => void;
    onOpenSettings?: () => void;
}

const COMPARATORS = ['>', '<', '>=', '<=', '==', '!='] as const;
type Comparator = typeof COMPARATORS[number];

export default function ConditionalWidget({ data, onClose, onOutputChange, onOpenSettings }: ConditionalWidgetProps) {
    const [comparator, setComparator] = useState<Comparator>((data.comparator as Comparator) || '>');

    // Sync if comparator changes externally
    useEffect(() => {
        if (data.comparator && COMPARATORS.includes(data.comparator as Comparator) && data.comparator !== comparator) {
            setComparator(data.comparator as Comparator);
        }
    }, [data.comparator]);

    // Evaluate the condition
    const evaluation = useMemo(() => {
        const a = data.a;
        const b = data.b;

        if (a === undefined || a === null || b === undefined || b === null) {
            return { result: null, aVal: a, bVal: b };
        }

        const numA = Number(a);
        const numB = Number(b);

        // Use numeric comparison if both convert to valid numbers
        const useNumeric = !isNaN(numA) && !isNaN(numB);
        const valA = useNumeric ? numA : String(a);
        const valB = useNumeric ? numB : String(b);

        let result = false;
        switch (comparator) {
            case '>': result = valA > valB; break;
            case '<': result = valA < valB; break;
            case '>=': result = valA >= valB; break;
            case '<=': result = valA <= valB; break;
            case '==': result = valA == valB; break;
            case '!=': result = valA != valB; break;
        }

        return { result, aVal: valA, bVal: valB };
    }, [data.a, data.b, comparator]);

    // Broadcast output changes
    useEffect(() => {
        if (evaluation.result !== null) {
            onOutputChange?.({
                result: evaluation.result ? 'true' : 'false',
                'true-value': evaluation.result ? data.a : null,
                'false-value': evaluation.result ? null : data.b,
            });
        } else {
            onOutputChange?.({ result: null, 'true-value': null, 'false-value': null });
        }
    }, [evaluation.result, data.a, data.b]); // eslint-disable-line

    const resultColor = evaluation.result === null
        ? 'var(--text-muted)'
        : evaluation.result
            ? '#3fb950'
            : '#f85149';

    const resultLabel = evaluation.result === null
        ? 'Awaiting inputs…'
        : evaluation.result
            ? '✅ TRUE'
            : '❌ FALSE';

    const formatVal = (v: any) => {
        if (v === undefined || v === null) return '--';
        if (Array.isArray(v)) return `[Array (${v.length})]`;
        return String(v);
    };

    return (
        <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Header */}
            <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'grab' }}>
                <h3 style={{ margin: 0, color: '#bc8cff', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                    <GitBranch size={17} /> If / Else
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {onOpenSettings && (
                        <button
                            onClick={onOpenSettings}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--primary)')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                    )}
                    {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}>✕</button>}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {/* Comparator selector */}
                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Comparator</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {COMPARATORS.map(op => (
                            <button
                                key={op}
                                onClick={() => setComparator(op)}
                                style={{
                                    flex: 1, padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                    fontFamily: 'monospace', fontSize: '14px', fontWeight: 700,
                                    background: op === comparator ? '#bc8cff' : 'rgba(255,255,255,0.05)',
                                    color: op === comparator ? '#000' : '#fff',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {op}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input values display */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>A (Left)</span>
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#58a6ff' }}>{formatVal(data.a)}</span>
                    </div>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#bc8cff', fontFamily: 'monospace' }}>{comparator}</span>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>B (Right)</span>
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#58a6ff' }}>{formatVal(data.b)}</span>
                    </div>
                </div>

                {/* Result display */}
                <div style={{
                    flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
                    background: `${resultColor}10`, borderRadius: '8px', border: `1px solid ${resultColor}30`,
                    marginTop: '4px', flexDirection: 'column', minHeight: '60px',
                }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Condition Result</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: resultColor }}>
                        {resultLabel}
                    </span>
                    {evaluation.result !== null && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {formatVal(evaluation.aVal)} {comparator} {formatVal(evaluation.bVal)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
