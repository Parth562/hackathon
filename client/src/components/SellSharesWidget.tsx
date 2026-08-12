"use client";

import React, { useState, useEffect } from 'react';
import { TrendingDown } from 'lucide-react';

interface SellSharesWidgetProps {
    data: {
        ticker?: string;
        quantity?: number;
        price?: number;
    };
    onClose?: (e: React.MouseEvent) => void;
    onOutputChange?: (updates: Record<string, any>) => void;
    onOpenSettings?: () => void;
}

export default function SellSharesWidget({ data, onClose, onOutputChange, onOpenSettings }: SellSharesWidgetProps) {
    const [ticker, setTicker] = useState(data.ticker || '');
    const [quantity, setQuantity] = useState<number>(data.quantity || 0);
    const [price, setPrice] = useState<number>(data.price || 0);
    const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    // Sync external prop changes (e.g. from port connections)
    useEffect(() => { if (data.ticker && data.ticker !== ticker) setTicker(data.ticker); }, [data.ticker]);
    useEffect(() => { if (data.quantity && data.quantity !== quantity) setQuantity(data.quantity); }, [data.quantity]);
    useEffect(() => { if (data.price && data.price !== price) setPrice(data.price); }, [data.price]);

    const handleSell = async () => {
        if (!ticker || quantity <= 0) { setMessage('Enter a valid ticker and quantity'); setStatus('error'); return; }

        setStatus('pending');
        setMessage('Processing order...');

        try {
            const res = await fetch('http://localhost:8261/api/portfolio/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove', ticker: ticker.toUpperCase(), shares: quantity, cost_basis: price || 0 }),
            });
            const json = await res.json();

            if (json.error) {
                setStatus('error');
                setMessage(json.error);
            } else {
                setStatus('success');
                setMessage(json.success || `Sold ${quantity} shares of ${ticker.toUpperCase()}`);
                onOutputChange?.({ status: 'sold', ticker: ticker.toUpperCase() });
            }
        } catch (err: any) {
            setStatus('error');
            setMessage('Network error – is the backend running?');
        }
    };

    const statusColors = { idle: 'var(--text-muted)', pending: '#f0883e', success: '#3fb950', error: '#f85149' };

    return (
        <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Header */}
            <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', cursor: 'grab' }}>
                <h3 style={{ margin: 0, color: '#f85149', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                    <TrendingDown size={17} /> Sell Shares
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

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Ticker Symbol</label>
                    <input
                        type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        placeholder="e.g. AAPL"
                        style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', color: '#fff', borderRadius: '6px', fontFamily: 'monospace', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Quantity</label>
                        <input
                            type="number" value={quantity || ''} onChange={(e) => setQuantity(Number(e.target.value))}
                            placeholder="0" min={0}
                            style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', color: '#fff', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Sale Price ($)</label>
                        <input
                            type="number" value={price || ''} onChange={(e) => setPrice(Number(e.target.value))}
                            placeholder="Market" min={0} step={0.01}
                            style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', color: '#fff', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {/* Sell Button */}
                <button
                    onClick={handleSell}
                    disabled={status === 'pending'}
                    style={{
                        padding: '10px', borderRadius: '8px', border: 'none', cursor: status === 'pending' ? 'wait' : 'pointer',
                        background: status === 'pending' ? 'rgba(248, 81, 73, 0.3)' : 'linear-gradient(135deg, #da3633, #f85149)',
                        color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginTop: '4px',
                        transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(248,81,73,0.25)',
                    }}
                    onMouseEnter={(e) => { if (status !== 'pending') (e.currentTarget.style.boxShadow = '0 4px 16px rgba(248,81,73,0.4)'); }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(248,81,73,0.25)'; }}
                >
                    {status === 'pending' ? '⏳ Processing...' : '📉 Sell Shares'}
                </button>

                {/* Status */}
                {message && (
                    <div style={{
                        padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500,
                        color: statusColors[status], background: 'rgba(0,0,0,0.2)', border: `1px solid ${statusColors[status]}30`,
                        marginTop: '4px',
                    }}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}
