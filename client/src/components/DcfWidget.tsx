"use client";

import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, Percent } from 'lucide-react';

export default function DcfWidget({ data, onClose }: { data: any; onClose: () => void }) {
    if (data.error || !data.inputs || !data.valuation) {
        return (
            <div className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                <h3 style={{ color: '#f85149', marginBottom: '16px' }}>DCF Valuation Error</h3>
                <p style={{ color: '#8b949e' }}>The agent returned malformed DCF data. Missing required inputs or valuation blocks.</p>
            </div>
        );
    }

    const { ticker, inputs, valuation } = data;

    const currentPrice = typeof valuation.current_price === 'number' ? valuation.current_price : null;
    const impliedPrice = valuation.implied_share_price || 0;
    const isUndervalued = currentPrice ? impliedPrice > currentPrice : false;
    const diffPercent = currentPrice ? ((impliedPrice - currentPrice) / currentPrice * 100).toFixed(1) : null;

    return (
        <div className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
            >
                ✕
            </button>

            <h3 style={{ color: 'var(--primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} />
                {ticker} DCF Valuation
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <p style={{ color: '#8b949e', fontSize: '0.9rem', marginBottom: '4px' }}>Implied Fair Value</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>${impliedPrice}</span>
                        {currentPrice && (
                            <span style={{ color: isUndervalued ? 'var(--secondary)' : '#f85149', fontSize: '0.9rem', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                                {isUndervalued ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                {diffPercent}%
                            </span>
                        )}
                    </div>
                    {currentPrice && <p style={{ color: '#8b949e', fontSize: '0.8rem', marginTop: '4px' }}>Current Price: ${currentPrice}</p>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                        <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>Growth Rate</span>
                        <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{((inputs.growth_rate || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                        <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>Discount Rate (WACC)</span>
                        <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{((inputs.discount_rate || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                        <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>Terminal Growth</span>
                        <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{((inputs.terminal_growth_rate || 0) * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
                <div>
                    <p style={{ color: '#8b949e', fontSize: '0.8rem' }}>Enterprise Value</p>
                    <p style={{ color: '#c9d1d9', fontSize: '0.9rem', fontWeight: 600 }}>${((valuation.enterprise_value || 0) / 1e9).toFixed(2)}B</p>
                </div>
                <div>
                    <p style={{ color: '#8b949e', fontSize: '0.8rem' }}>Equity Value</p>
                    <p style={{ color: '#c9d1d9', fontSize: '0.9rem', fontWeight: 600 }}>${((valuation.equity_value || 0) / 1e9).toFixed(2)}B</p>
                </div>
            </div>
        </div>
    );
}
