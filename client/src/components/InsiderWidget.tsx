"use client";

import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';

export default function InsiderWidget({ data, onClose }: { data: any; onClose: () => void }) {
    if (data.error) return null;
    const { ticker, insider_data } = data;

    const purchases = insider_data.insider_purchases || [];

    return (
        <div className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
            >
                ✕
            </button>

            <h3 style={{ color: 'var(--accent)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} />
                {ticker} Insider Trading Activity
            </h3>

            {purchases.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ color: '#8b949e', borderBottom: '1px solid var(--panel-border)' }}>
                                <th style={{ padding: '8px' }}>Insider Name</th>
                                <th style={{ padding: '8px' }}>Shares</th>
                                <th style={{ padding: '8px' }}>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.slice(0, 10).map((p: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px', color: '#fff', fontWeight: 500 }}>{p.Insider}</td>
                                    <td style={{ padding: '8px', color: 'var(--primary)' }}>{p.Shares ? p.Shares.toLocaleString() : 'Loading'}</td>
                                    <td style={{ padding: '8px', color: '#c9d1d9' }}>{p.Text}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b949e', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <AlertTriangle size={16} />
                    <p>No recent insider transactions found for {ticker}.</p>
                </div>
            )}
        </div>
    );
}
