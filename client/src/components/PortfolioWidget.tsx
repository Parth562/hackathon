"use client";

import React from 'react';
import { Briefcase, AlertTriangle, TrendingUp, TrendingDown, PieChart } from 'lucide-react';

export default function PortfolioWidget({ data, onClose }: { data: any; onClose: () => void }) {
    if (data.error || !data.summary || !data.holdings) {
        return (
            <div className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                <h3 style={{ color: '#f85149', marginBottom: '16px' }}>Portfolio Analysis Error</h3>
                <p style={{ color: '#8b949e' }}>{data.error || 'The agent returned malformed portfolio data.'}</p>
            </div>
        );
    }

    const { summary, holdings, sectors, alerts } = data;

    return (
        <div className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
            >
                ✕
            </button>

            <h3 style={{ color: 'var(--primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Briefcase size={20} />
                Portfolio Risk & PnL Analysis
            </h3>

            {/* Top Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <p style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: '4px' }}>Total Value</p>
                    <span style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff' }}>${summary.total_value.toLocaleString()}</span>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <p style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: '4px' }}>Total Cost Basis</p>
                    <span style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff' }}>${summary.total_cost.toLocaleString()}</span>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <p style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: '4px' }}>Unrealized P&L</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 600, color: summary.overall_pnl >= 0 ? 'var(--secondary)' : '#f85149' }}>
                            ${Math.abs(summary.overall_pnl).toLocaleString()}
                        </span>
                        <span style={{ color: summary.overall_pnl >= 0 ? 'var(--secondary)' : '#f85149', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                            {summary.overall_pnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {summary.overall_pnl_pct}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Alerts Section */}
            {alerts && alerts.length > 0 && (
                <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(248, 81, 73, 0.1)', borderLeft: '4px solid #f85149', borderRadius: '0 8px 8px 0' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f85149', marginBottom: '8px', margin: 0 }}>
                        <AlertTriangle size={18} /> Concentration Risks Detected
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#ff7b72', fontSize: '0.9rem' }}>
                        {alerts.map((alert: string, idx: number) => (
                            <li key={idx}>{alert}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Holdings Table */}
            <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--panel-border)', color: '#8b949e', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>Ticker</th>
                            <th style={{ padding: '8px' }}>Shares</th>
                            <th style={{ padding: '8px' }}>Price</th>
                            <th style={{ padding: '8px' }}>Value</th>
                            <th style={{ padding: '8px' }}>Weight</th>
                            <th style={{ padding: '8px' }}>P&L (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {holdings.map((h: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '8px', fontWeight: 600, color: 'var(--primary)' }}>{h.ticker}</td>
                                <td style={{ padding: '8px' }}>{h.shares}</td>
                                <td style={{ padding: '8px' }}>${h.price}</td>
                                <td style={{ padding: '8px' }}>${h.value.toLocaleString()}</td>
                                <td style={{ padding: '8px' }}>{h.weight_pct}%</td>
                                <td style={{ padding: '8px', color: h.pnl >= 0 ? 'var(--secondary)' : '#f85149' }}>
                                    {h.pnl_pct > 0 ? '+' : ''}{h.pnl_pct}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Sector Breakdown */}
            {sectors && sectors.length > 0 && (
                <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b949e', marginBottom: '12px' }}>
                        <PieChart size={16} /> Sector Allocation
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {sectors.map((s: any, idx: number) => (
                            <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem' }}>
                                <span style={{ color: '#c9d1d9', marginRight: '8px' }}>{s.name}</span>
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{s.weight_pct}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
