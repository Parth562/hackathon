"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Layers } from 'lucide-react';
import {
    ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Legend, Bar, Line, CartesianGrid
} from 'recharts';

interface CustomWidgetProps {
    data: any;
    onClose: () => void;
}

export default function CustomWidget({ data, onClose }: CustomWidgetProps) {
    const { title, content_type, data: widgetData } = data;

    const renderContent = () => {
        if (!widgetData) {
            return <div style={{ color: '#8b949e', fontStyle: 'italic' }}>No data provided by AI.</div>;
        }

        switch (content_type) {
            case 'markdown':
                return (
                    <div className="markdown-body" style={{ color: 'var(--foreground)', fontSize: '0.9rem', overflowY: 'auto', maxHeight: '100%' }}>
                        <ReactMarkdown>{widgetData.content || '*No content block received*'}</ReactMarkdown>
                    </div>
                );
            case 'metrics':
                // Expected format: { metrics: { "Key1": "Val1", "Key2": "Val2" } }
                if (!widgetData.metrics || typeof widgetData.metrics !== 'object') {
                    return <div style={{ color: '#f85149' }}>Invalid metrics payload.</div>;
                }
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                        {Object.entries(widgetData.metrics).map(([key, value]) => (
                            <div key={key} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                                <div style={{ color: '#8b949e', fontSize: '0.8rem', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {key}
                                </div>
                                <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>
                                    {String(value)}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'chart':
                // The LLM sometimes hallucinates the nesting and puts series directly on the root data object instead of inside chart_data
                const chartData = widgetData.chart_data || widgetData;

                if (!chartData || !chartData.series || !chartData.data) {
                    return (
                        <div style={{ color: '#f85149', padding: '16px' }}>
                            <p>Invalid chart payload schema.</p>
                            <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', overflowX: 'auto', fontSize: '11px' }}>
                                {JSON.stringify(widgetData, null, 2)}
                            </pre>
                        </div>
                    );
                }

                return (
                    <div style={{ width: '100%', height: '100%', padding: '8px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData.data} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey={chartData.x_axis_key || 'name'}
                                    stroke="#8b949e"
                                    tick={{ fill: '#8b949e', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#8b949e"
                                    tick={{ fill: '#8b949e', fontSize: 12 }}
                                    dx={-10}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(13, 17, 23, 0.9)', borderColor: 'rgba(48, 54, 61, 1)', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#c9d1d9' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />

                                {/* Dynamically generate Series mappings */}
                                {chartData.series.map((s: any, idx: number) => {
                                    if (s.type === 'bar') {
                                        return <Bar key={idx} dataKey={s.dataKey} fill={s.color || 'var(--primary)'} name={s.name || s.dataKey} />;
                                    }
                                    if (s.type === 'line') {
                                        return <Line key={idx} type="monotone" dataKey={s.dataKey} stroke={s.color || '#58a6ff'} strokeWidth={3} dot={{ r: 4 }} name={s.name || s.dataKey} />;
                                    }
                                    return null;
                                })}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                );
            default:
                return <div style={{ color: '#8b949e' }}>Unsupported content type: {content_type}</div>;
        }
    };

    return (
        <div className="glass-panel" style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px', zIndex: 10 }}
            >
                ✕
            </button>
            <h3 className="drag-handle" style={{ color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'grab', paddingRight: '24px' }}>
                <Layers size={18} />
                {title || 'Custom Widget'}
            </h3>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {renderContent()}
            </div>
        </div>
    );
}
