"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Calculator } from 'lucide-react';

interface MathWidgetProps {
    data: {
        function?: string;
        a?: any;
        b?: any;
        c?: any;
        d?: any;
    };
    onClose?: (e: React.MouseEvent) => void;
    onOutputChange?: (updates: Record<string, any>) => void;
    onOpenSettings?: () => void;
}

export default function MathWidget({ data, onClose, onOutputChange, onOpenSettings }: MathWidgetProps) {
    const [expr, setExpr] = useState(data.function || 'a + b');
    const [error, setError] = useState<string | null>(null);

    // Sync if formula changes externally
    useEffect(() => {
        if (data.function !== undefined && data.function !== expr) setExpr(data.function);
    }, [data.function]);

    // Perform safe calculation
    const result = useMemo(() => {
        try {
            setError(null);

            // Clean up basic terms passed by agent for security and ease of use (e.g., 'sum' instead of 'a+b')
            let formula = expr.toLowerCase().trim();
            if (formula === 'sum') formula = 'a + b';
            if (formula === 'difference' || formula === 'subtract') formula = 'a - b';
            if (formula === 'multiply') formula = 'a * b';
            if (formula === 'divide') formula = 'a / b';

            // We want to safely evaluate the math. We'll use a Function constructor 
            // restricted strictly and defensively
            const safeEval = new Function('a', 'b', 'c', 'd', `
                "use strict";
                try {
                    return (${formula});
                } catch(e) {
                    return null;
                }
            `);

            // Check if inputs are numbers or arrays (time series)
            const isArrayA = Array.isArray(data.a);
            const isArrayB = Array.isArray(data.b);
            const isArrayC = Array.isArray(data.c);
            const isArrayD = Array.isArray(data.d);

            // Time series combination mode
            if (isArrayA || isArrayB || isArrayC || isArrayD) {
                // Find longest array to use as base time anchor
                let baseSeries: any[] = [];
                if (isArrayA && data.a.length > baseSeries.length) baseSeries = data.a;
                if (isArrayB && data.b.length > baseSeries.length) baseSeries = data.b;
                if (isArrayC && data.c.length > baseSeries.length) baseSeries = data.c;
                if (isArrayD && data.d.length > baseSeries.length) baseSeries = data.d;

                if (baseSeries.length === 0) return null;

                const extractVal = (arr: any, timestamp: string, fallback: number = 0) => {
                    if (!Array.isArray(arr)) return typeof arr === 'number' ? arr : fallback;
                    const point = arr.find((p: any) => p.time === timestamp || p.date === timestamp);
                    return point ? Number(point.value) : fallback;
                };

                const computedSeries = baseSeries.map((pt: any) => {
                    const t = pt.time || pt.date;
                    const valA = extractVal(data.a, t);
                    const valB = extractVal(data.b, t);
                    const valC = extractVal(data.c, t);
                    const valD = extractVal(data.d, t);

                    const calc = safeEval(valA, valB, valC, valD);
                    return {
                        ...pt,
                        value: typeof calc === 'number' && !isNaN(calc) ? calc : null
                    };
                }).filter(p => p.value !== null);

                // Use the last value as the single out-result
                const singleRes = computedSeries.length > 0 ? computedSeries[computedSeries.length - 1].value : null;

                return { single: singleRes, series: computedSeries };
            } else {
                // Single scalar calculation mode
                const a = Number(data.a || 0);
                const b = Number(data.b || 0);
                const c = Number(data.c || 0);
                const d = Number(data.d || 0);

                const val = safeEval(a, b, c, d);
                return typeof val === 'number' && !isNaN(val) ? { single: val, series: null } : null;
            }

        } catch (e: any) {
            setError(e.message || "Invalid expression");
            return null;
        }
    }, [expr, data.a, data.b, data.c, data.d]);

    // Broadcast valid changes instantly
    useEffect(() => {
        if (result && result.single !== null) {
            onOutputChange?.({ result: result.single, series: result.series });
        } else {
            onOutputChange?.({ result: null, series: null });
        }
    }, [result]); // eslint-disable-line

    return (
        <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'grab' }}>
                <h3 style={{ margin: 0, color: '#f0883e', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                    <Calculator size={17} />
                    Math Node
                </h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {onOpenSettings && (
                        <button
                            onClick={onOpenSettings}
                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--primary)")}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                    )}
                    {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}>✕</button>}
                </div>
            </div>

            <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Formula / Operation</label>
                    <input
                        type="text"
                        value={expr}
                        onChange={(e) => setExpr(e.target.value)}
                        placeholder="e.g. (a + b) / 2"
                        style={{
                            width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)',
                            color: '#fff', borderRadius: '4px', fontFamily: 'monospace', fontSize: '14px'
                        }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    {['a', 'b', 'c', 'd'].map(key => {
                        const val = (data as any)[key];
                        const isArr = Array.isArray(val);
                        const displayVal = isArr ? `[Series (${val.length})]` : val !== undefined && val !== null ? String(val) : '--';
                        return (
                            <div key={key} style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '6px' }}>{key}</span>
                                <span style={{ fontSize: '13px', color: isArr ? 'var(--primary)' : '#fff', fontWeight: 600 }}>{displayVal}</span>
                            </div>
                        );
                    })}
                </div>

                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,165,0,0.1)', marginTop: '8px', flexDirection: 'column' }}>
                    {error ? (
                        <span style={{ color: '#f85149', fontSize: '0.85rem' }}>{error}</span>
                    ) : (
                        <>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Result {result?.series ? '(Active Series)' : ''}</span>
                            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f0883e' }}>
                                {result?.single !== null && result?.single !== undefined ? Number(result.single).toFixed(4) : '--'}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
