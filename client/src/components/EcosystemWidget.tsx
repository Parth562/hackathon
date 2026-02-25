"use client";

import React from 'react';
import { Network, Link } from 'lucide-react';

export default function EcosystemWidget({ data, onClose }: { data: any; onClose: () => void }) {
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
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
            >
                ✕
            </button>

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
