"use client";

import React from 'react';
import ChartWidget from './ChartWidget';
import DcfWidget from './DcfWidget';
import InsiderWidget from './InsiderWidget';
import EcosystemWidget from './EcosystemWidget';

interface DynamicBoardProps {
    widgets: any[];
    onRemoveWidget: (id: string) => void;
}

export default function DynamicBoard({ widgets, onRemoveWidget }: DynamicBoardProps) {
    if (widgets.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8b949e' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#fff' }}>Interactive Board</h2>
                <p>Ask the agent to generate a graph or DCF model, and it will appear here dynamically.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px', paddingBottom: '24px' }}>
            {widgets.map(w => {
                // Determine widget type based on payload
                if (w.data.error) {
                    return null;
                }

                const widgetType = w.data.widget_type || w.data.type || w.data.chart_type;

                if (w.data.chart_type || widgetType === 'chart') {
                    return <ChartWidget key={w.id} data={w.data} onClose={() => onRemoveWidget(w.id)} />;
                } else if (widgetType === 'dcf') {
                    return <DcfWidget key={w.id} data={w.data} onClose={() => onRemoveWidget(w.id)} />;
                } else if (widgetType === 'insider_trading') {
                    return <InsiderWidget key={w.id} data={w.data} onClose={() => onRemoveWidget(w.id)} />;
                } else if (widgetType === 'ecosystem') {
                    return <EcosystemWidget key={w.id} data={w.data} onClose={() => onRemoveWidget(w.id)} />;
                }

                // Fallback for generic tables (Correlation, Leading Companies)
                const title = widgetType ? widgetType.replace('_', ' ') : 'Structured Analysis';
                return (
                    <div key={w.id} className="glass-panel" style={{ position: 'relative', animation: 'fadeIn 0.5s ease-out' }}>
                        <button
                            onClick={() => onRemoveWidget(w.id)}
                            style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
                        >
                            ✕
                        </button>
                        <h3 style={{ color: 'var(--primary)', marginBottom: '16px', textTransform: 'capitalize' }}>
                            {title}
                        </h3>
                        <pre style={{ overflowX: 'auto', backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', fontSize: '0.85rem' }}>
                            {JSON.stringify(w.data, null, 2)}
                        </pre>
                    </div>
                );
            })}
        </div>
    );
}
