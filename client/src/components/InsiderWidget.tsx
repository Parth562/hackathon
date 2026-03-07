"use client";

import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';

export default function InsiderWidget({ data, onClose, onOpenSettings }: { data: any; onClose: () => void; onOpenSettings?: () => void }) {
    if (data.error) return null;
    const { ticker, insider_data } = data;

    const purchases = insider_data.insider_purchases || [];

    return (
        <div className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ position: 'absolute', top: '12px', right: '16px', display: 'flex', gap: '8px', zIndex: 10 }}>
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
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
                >
                    ✕
                </button>
            </div>

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
