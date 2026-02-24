"use client";

import React from 'react';
import { Network, Link } from 'lucide-react';

export default function EcosystemWidget({ data, onClose }: { data: any; onClose: () => void }) {
    if (data.error) return null;
    const { ticker, ecosystem_data } = data;

    return (
        <div className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
            >
                ✕
            </button>

            <h3 style={{ color: 'var(--accent)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={20} />
                {ticker} Supply Chain & Ecosystem
            </h3>

            <div style={{ lineHeight: '1.6', fontSize: '0.90rem', color: '#c9d1d9', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                {ecosystem_data.split('Supplier Info:').map((chunk: string, i: number) => {
                    if (i === 0) return null;
                    return <div key={i} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>Supplier:</span> {chunk.split('Customer Info:')[0]}
                    </div>
                })}
                {/* We just render the raw scraped text elegantly since it's unstructured text from DDG */}
                <p style={{ fontStyle: 'italic', opacity: 0.8 }}>
                    {ecosystem_data.length > 300 ? ecosystem_data.substring(0, 300) + '...' : ecosystem_data}
                </p>
            </div>
        </div>
    );
}
