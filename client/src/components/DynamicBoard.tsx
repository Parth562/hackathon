"use client";

import React, { useState, useEffect } from 'react';
import { ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import ChartWidget from './ChartWidget';
import DcfWidget from './DcfWidget';
import InsiderWidget from './InsiderWidget';
import EcosystemWidget from './EcosystemWidget';
import CustomWidget from './CustomWidget';

interface DynamicBoardProps {
    widgets: any[];
    onRemoveWidget: (id: string) => void;
}

const WidgetRenderer = ({ widget: w, onRemoveWidget }: { widget: any, onRemoveWidget: (id: string) => void }) => {
    if (w.data.error) {
        return <div style={{ display: 'none' }} />;
    }

    const widgetType = w.data.widget_type || w.data.type || w.data.chart_type;

    if (w.data.chart_type || widgetType === 'chart') {
        return <ChartWidget data={w.data} onClose={() => onRemoveWidget(w.id)} />;
    } else if (widgetType === 'dcf') {
        return <DcfWidget data={w.data} onClose={() => onRemoveWidget(w.id)} />;
    } else if (widgetType === 'insider_trading') {
        return <InsiderWidget data={w.data} onClose={() => onRemoveWidget(w.id)} />;
    } else if (widgetType === 'ecosystem') {
        return <EcosystemWidget data={w.data} onClose={() => onRemoveWidget(w.id)} />;
    } else if (widgetType === 'custom') {
        return <CustomWidget data={w.data} onClose={() => onRemoveWidget(w.id)} />;
    } else {
        const title = widgetType ? widgetType.replace('_', ' ') : 'Structured Analysis';
        return (
            <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <button
                    onClick={() => onRemoveWidget(w.id)}
                    style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px', zIndex: 10 }}
                >
                    ✕
                </button>
                <h3 className="drag-handle" style={{ color: 'var(--primary)', marginBottom: '16px', textTransform: 'capitalize', cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                    {title}
                </h3>
                <pre style={{ flex: 1, overflow: 'auto', backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', fontSize: '0.85rem' }}>
                    {JSON.stringify(w.data, null, 2)}
                </pre>
            </div>
        );
    }
};

export default function DynamicBoard({ widgets, onRemoveWidget }: DynamicBoardProps) {
    if (widgets.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8b949e' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#fff' }}>Interactive Board</h2>
                <p>Ask the agent to generate a graph or DCF model, and it will appear here dynamically.</p>
            </div>
        );
    }

    // Autogenerate layout items for new widgets if not explicitly provided
    const [layout, setLayout] = useState<any[]>([]);

    useEffect(() => {
        // Sync layout state when widgets change (e.g., new widget added via chat)
        const newLayout = widgets.map((w, index) => {
            // Find existing layout item to maintain position, or create a new one
            const existing = layout.find(l => l.i === w.id);
            if (existing) return existing;

            // Default positioning logic: flow them in rows of 2
            return {
                i: w.id,
                x: (index % 2) * 6, // 12 column grid
                y: Math.floor(index / 2) * 4,
                w: 6,
                h: 4,
                minW: 4,
                minH: 3
            };
        });
        setLayout(newLayout);
    }, [widgets]);

    const handleLayoutChange = (newLayout: any) => {
        setLayout(newLayout as any[]);
    };

    return (
        // @ts-expect-error The WidthProp is injected automatically by ResponsiveGridLayout, but @types fails to recognize this.
        <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: layout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            onLayoutChange={handleLayoutChange}
            style={{ minHeight: '100%', paddingBottom: '24px' }}
        >
            {widgets.map(w => {
                const defaultLayoutConfig = layout.find(l => l.i === w.id) || {
                    x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3
                };

                return (
                    <div key={w.id} data-grid={defaultLayoutConfig} style={{ display: 'flex', flexDirection: 'column' }}>
                        <WidgetRenderer widget={w} onRemoveWidget={onRemoveWidget} />
                    </div>
                );
            })}
        </ResponsiveGridLayout>
    );
}
