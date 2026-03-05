"use client";

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

export default function SupplyChainWidget({ data, onClose }: { data: any; onClose: () => void }) {
    if (data.error) return null;
    
    const { analysis } = data;
    if (!analysis) return <div>No analysis data available</div>;

    const { target, supplier_impact, customer_impact } = analysis;

    // Transform dictionary to array for Recharts
    const supplierData = Object.entries(supplier_impact).map(([ticker, correlation]) => ({
        name: ticker,
        correlation: correlation
    }));

    const customerData = Object.entries(customer_impact).map(([ticker, correlation]) => ({
        name: ticker,
        correlation: correlation
    }));

    const renderChart = (title: string, chartData: any[], color: string) => (
        <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#8b949e', marginBottom: '12px', textAlign: 'center' }}>{title}</h4>
            <div style={{ height: 200, width: '100%' }}>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.1)" />
                            <XAxis type="number" domain={[-1, 1]} hide />
                            <YAxis dataKey="name" type="category" stroke="#8b949e" width={50} tick={{fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px' }}
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                formatter={(value: any) => [typeof value === 'number' ? value.toFixed(2) : value, 'Correlation']}
                            />
                            <Bar dataKey="correlation" fill={color} radius={[0, 4, 4, 0]} barSize={20}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.correlation > 0 ? color : '#f85149'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8b949e', fontStyle: 'italic' }}>
                        No data available
                    </div>
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

            <h3 style={{ color: 'var(--accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Returns Correlation Analysis
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#8b949e', marginBottom: '24px' }}>
                Impact on <strong>{target}</strong> (6mo correlation)
            </p>

            {renderChart('Key Suppliers', supplierData, '#238636')}
            {renderChart('Major Customers', customerData, '#1f6feb')}
            
            <div style={{ fontSize: '0.75rem', color: '#8b949e', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                * Correlation &gt; 0.5 indicates strong positive relationship. Negative values indicate inverse movement.
            </div>
        </div>
    );
}
