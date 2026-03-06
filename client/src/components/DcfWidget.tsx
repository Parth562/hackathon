"use client";

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, Percent, Download } from 'lucide-react';

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

    // State variables for sensitivities
    const [growthRate, setGrowthRate] = useState(inputs.growth_rate || 0);
    const [discountRate, setDiscountRate] = useState(inputs.discount_rate || 0);
    const [terminalGrowth, setTerminalGrowth] = useState(inputs.terminal_growth_rate || 0);

    // Fast recalculation math client-side based on new slider states
    // These recalculate Enterprise Value given the base FCF and new rates
    const currentFcf = inputs.base_fcf || 0;
    const years = inputs.projection_years || 5;

    let sumPvFcf = 0;
    let projectedFcf = 0;
    for (let i = 1; i <= years; i++) {
        projectedFcf = currentFcf * Math.pow(1 + growthRate, i);
        sumPvFcf += projectedFcf / Math.pow(1 + discountRate, i);
    }

    let terminalValue = 0;
    let pvTerminalValue = 0;
    if (discountRate > terminalGrowth) {
        terminalValue = (projectedFcf * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
        pvTerminalValue = terminalValue / Math.pow(1 + discountRate, years);
    }

    const newEnterpriseValue = sumPvFcf + pvTerminalValue;
    const debtRatio = (valuation.enterprise_value - valuation.equity_value); // Recover net debt proxy
    const newEquityValue = newEnterpriseValue - debtRatio;

    // Recover shares outstanding from the initial payload implied price
    const sharesOutstanding = valuation.equity_value / valuation.implied_share_price;
    const newImpliedPrice = (newEquityValue / sharesOutstanding).toFixed(2);

    const isUndervalued = currentPrice ? parseFloat(newImpliedPrice) > currentPrice : false;
    const diffPercent = currentPrice ? (((parseFloat(newImpliedPrice) - currentPrice) / currentPrice) * 100).toFixed(1) : null;

    const exportToCSV = () => {
        const rows = [
            ["Metric", "Value"],
            ["Ticker", ticker],
            ["Implied Share Price", "$" + newImpliedPrice],
            ["Current Price", currentPrice ? "$" + currentPrice : "N/A"],
            ["Growth Rate", (growthRate * 100).toFixed(1) + "%"],
            ["Discount Rate (WACC)", (discountRate * 100).toFixed(1) + "%"],
            ["Terminal Growth", (terminalGrowth * 100).toFixed(1) + "%"],
            ["Enterprise Value", "$" + (newEnterpriseValue / 1e9).toFixed(2) + "B"],
            ["Equity Value", "$" + (newEquityValue / 1e9).toFixed(2) + "B"]
        ];

        let csvContent = "data:text/csv;charset=utf-8,";
        rows.forEach(row => {
            csvContent += row.join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${ticker}_dcf_valuation.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ position: 'absolute', top: '12px', right: '16px', display: 'flex', gap: '12px' }}>
                <button onClick={exportToCSV} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }} title="Export CSV">
                    <Download size={18} />
                </button>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}>
                    ✕
                </button>
            </div>

            <h3 style={{ color: 'var(--primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} />
                {ticker} DCF Sensitivity Model
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <p style={{ color: '#8b949e', fontSize: '0.9rem', marginBottom: '4px' }}>Implied Fair Value</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>${newImpliedPrice}</span>
                        {currentPrice && (
                            <span style={{ color: isUndervalued ? 'var(--secondary)' : '#f85149', fontSize: '0.9rem', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                                {isUndervalued ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                {diffPercent}%
                            </span>
                        )}
                    </div>
                    {currentPrice && <p style={{ color: '#8b949e', fontSize: '0.8rem', marginTop: '4px' }}>Current Price: ${currentPrice}</p>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Growth Rate Slider */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>Growth Rate</span>
                            <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{(growthRate * 100).toFixed(1)}%</span>
                        </div>
                        <input
                            type="range" min="-0.10" max="0.50" step="0.01"
                            value={growthRate}
                            onChange={(e) => setGrowthRate(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--primary)' }}
                        />
                    </div>

                    {/* Discount Rate Slider */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>Discount Rate (WACC)</span>
                            <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{(discountRate * 100).toFixed(1)}%</span>
                        </div>
                        <input
                            type="range" min="0.01" max="0.30" step="0.01"
                            value={discountRate}
                            onChange={(e) => setDiscountRate(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--primary)' }}
                        />
                    </div>

                    {/* Terminal Growth Slider */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>Terminal Growth</span>
                            <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{(terminalGrowth * 100).toFixed(1)}%</span>
                        </div>
                        <input
                            type="range" min="0.00" max="0.05" step="0.005"
                            value={terminalGrowth}
                            onChange={(e) => setTerminalGrowth(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--primary)' }}
                        />
                    </div>

                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
                <div>
                    <p style={{ color: '#8b949e', fontSize: '0.8rem' }}>Enterprise Value</p>
                    <p style={{ color: '#c9d1d9', fontSize: '0.9rem', fontWeight: 600 }}>${(newEnterpriseValue / 1e9).toFixed(2)}B</p>
                </div>
                <div>
                    <p style={{ color: '#8b949e', fontSize: '0.8rem' }}>Equity Value</p>
                    <p style={{ color: '#c9d1d9', fontSize: '0.9rem', fontWeight: 600 }}>${(newEquityValue / 1e9).toFixed(2)}B</p>
                </div>
            </div>
        </div>
    );
}
