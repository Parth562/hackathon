"use client";

import React from 'react';
import { Network, Link } from 'lucide-react';

export default function EcosystemWidget({ data, onClose, onOpenSettings }: { data: any; onClose: () => void; onOpenSettings?: () => void }) {
    if (data.error) return null;
    const { ticker, ecosystem_data } = data;

    // Helper to render section
    const renderSection = (title: string, items: string[]) => (
        <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: 'var(--secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '8px' }}>{title}</h4>
            <div style={{ paddingLeft: '8px' }}>
                {items && items.length > 0 ? (
                    items.map((item, idx) => (
                        <div key={idx} style={{
                            padding: '8px',
                            marginBottom: '6px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            color: '#c9d1d9'
                        }}>
                            {item}
                        </div>
                    ))
                ) : (
                    <span style={{ fontStyle: 'italic', opacity: 0.5 }}>No data found.</span>
                )}
            </div>
        </div>
    );

    return (
        <div className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out', height: '100%', overflowY: 'auto' }}>
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
                <Network size={20} />
                {ticker} Ecosystem Analysis
            </h3>

            <div style={{ lineHeight: '1.6' }}>
                {renderSection('Key Suppliers', ecosystem_data.suppliers)}
                {renderSection('Major Customers', ecosystem_data.customers)}
                {renderSection('Competitors', ecosystem_data.competitors)}
            </div>
        </div>
    );
}
