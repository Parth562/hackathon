"use client";

import React, { memo, useState } from 'react';
import { Handle, Position, NodeResizer, useReactFlow, useEdges } from 'reactflow';
import { Settings } from 'lucide-react';
import ChartWidget from './ChartWidget';
import DcfWidget from './DcfWidget';
import InsiderWidget from './InsiderWidget';
import EcosystemWidget from './EcosystemWidget';
import SupplyChainWidget from './SupplyChainWidget';
import CustomWidget from './CustomWidget';
import PortfolioWidget from './PortfolioWidget';
import KpiDashboardWidget from './KpiDashboardWidget';
import PeerBenchmarkWidget from './PeerBenchmarkWidget';
import ThesisWidget from './ThesisWidget';
import RiskScoreWidget from './RiskScoreWidget';
import ScenarioWidget from './ScenarioWidget';
import PredictionWidget from './PredictionWidget';
import TableWidget from './TableWidget';
import LiveStockWidget from './LiveStockWidget';
import PreprocessingWidget from './PreprocessingWidget';
import ComputationalWidget from './ComputationalWidget';
import MathWidget from './MathWidget';
import WidgetSettingsDrawer, { type EdgeBinding } from './WidgetSettingsDrawer';
import { getSchema, PORT_COLORS, PortDef } from '@/lib/widgetSchema';

// ── Port handle strip ─────────────────────────────────────────────────────────
function PortHandle({ port, side }: { port: PortDef; side: "input" | "output" }) {
    const position = side === "input" ? Position.Left : Position.Right;
    const type = side === "input" ? "target" : "source";
    const color = PORT_COLORS[port.type];

    return (
        <Handle
            key={port.id}
            id={port.id}
            type={type}
            position={position}
            title={`${port.label} (${port.type}): ${port.description}`}
            style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: color,
                border: "2.5px solid var(--bg-sidebar)",
                position: "absolute",
                [side === "input" ? "left" : "right"]: "-6px",
            }}
        />
    );
}

// ── Main component ────────────────────────────────────────────────────────────
const GenericWidgetNode = ({ data, selected, id }: { data: any; selected: boolean; id: string }) => {
    const { widgetData, onRemove } = data;
    const [settingsOpen, setSettingsOpen] = useState(false);
    const edges = useEdges();
    const { setEdges, setNodes } = useReactFlow();

    const widgetType = widgetData?.widget_type || widgetData?.type || widgetData?.chart_type;
    const schema = getSchema(widgetType ?? "");

    const inputs = schema?.inputs ?? [];
    const outputs = schema?.outputs ?? [];

    // Build edge binding info for the settings drawer
    const inputBindings: EdgeBinding[] = edges
        .filter((e) => e.target === id && e.targetHandle)
        .map((e) => ({
            edgeId: e.id,
            portId: e.targetHandle!,
            remoteLabel: e.sourceHandle ?? e.source.slice(0, 8),
        }));

    const outputBindings: EdgeBinding[] = edges
        .filter((e) => e.source === id && e.sourceHandle)
        .map((e) => ({
            edgeId: e.id,
            portId: e.sourceHandle!,
            remoteLabel: e.targetHandle ?? e.target.slice(0, 8),
        }));

    const handleClose = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (onRemove) onRemove();
    };

    const handleDisconnect = (edgeId: string) => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    };

    const handleOutputChange = (updates: Record<string, any>) => {
        setNodes((nds) => nds.map((n) => {
            if (n.id === id) {
                return {
                    ...n,
                    data: {
                        ...n.data,
                        outputData: { ...(n.data.outputData || {}), ...updates }
                    }
                };
            }
            return n;
        }));
    };

    let content = null;
    if (widgetData?.chart_type || widgetType === 'chart') {
        content = <ChartWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'dcf') {
        content = <DcfWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'insider_trading') {
        content = <InsiderWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'ecosystem') {
        content = <EcosystemWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'supply_chain_impact') {
        content = <SupplyChainWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'custom') {
        content = <CustomWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'portfolio_analysis') {
        content = <PortfolioWidget data={widgetData} onClose={handleClose} onOutputChange={handleOutputChange} />;
    } else if (widgetType === 'kpi_dashboard') {
        content = <KpiDashboardWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'peer_benchmark') {
        content = <PeerBenchmarkWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'thesis') {
        content = <ThesisWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'risk_score') {
        content = <RiskScoreWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'scenario') {
        content = <ScenarioWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'prediction') {
        content = <PredictionWidget data={widgetData} onClose={handleClose} />;
    } else if (widgetType === 'table') {
        content = <TableWidget data={widgetData} onClose={handleClose} onOutputChange={handleOutputChange} />;
    } else if (widgetType === 'live_stock') {
        content = <LiveStockWidget data={widgetData} onClose={handleClose} onOutputChange={handleOutputChange} />;
    } else if (widgetType === 'preprocessing') {
        content = <PreprocessingWidget data={widgetData} onClose={handleClose} onOutputChange={handleOutputChange} />;
    } else if (widgetType === 'computational') {
        content = <ComputationalWidget data={widgetData} onClose={handleClose} onOutputChange={handleOutputChange} />;
    } else if (widgetType === 'math') {
        content = <MathWidget data={widgetData} onClose={handleClose} onOutputChange={handleOutputChange} />;
    } else {
        const title = widgetType ? widgetType.replace('_', ' ') : 'Structured Analysis';
        content = (
            <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <button
                    onClick={handleClose}
                    style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px', zIndex: 100 }}
                >
                    ✕
                </button>
                <h3 className="drag-handle" style={{ color: 'var(--primary)', marginBottom: '16px', textTransform: 'capitalize', cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                    {title}
                </h3>
                <pre style={{ flex: 1, overflow: 'auto', backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', fontSize: '0.85rem' }}>
                    {JSON.stringify(widgetData, null, 2)}
                </pre>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <NodeResizer
                isVisible={selected}
                minWidth={300}
                minHeight={200}
                handleStyle={{ width: 10, height: 10, borderRadius: 5, background: 'var(--accent)', border: '2px solid #fff' }}
                lineStyle={{ border: '2px dashed var(--accent)' }}
            />

            {/* ⚙️ Settings button — top right corner of node */}
            <button
                title="Widget Settings"
                onClick={(e) => { e.stopPropagation(); setSettingsOpen(true); }}
                style={{
                    position: "absolute", top: "8px", right: "8px",
                    zIndex: 200,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "6px",
                    padding: "4px",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: selected ? 1 : 0,
                    transition: "opacity 0.15s, color 0.15s",
                    pointerEvents: selected ? "all" : "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
                <Settings size={13} />
            </button>

            {/* ↙ Input handles (left side) */}
            {inputs.map((port, i) => {
                const totalPorts = inputs.length;
                const pct = totalPorts === 1 ? 50 : 20 + (60 / (totalPorts - 1)) * i;
                return (
                    <Handle
                        key={port.id}
                        id={port.id}
                        type="target"
                        position={Position.Left}
                        title={`${port.label} (${port.type}): ${port.description}`}
                        style={{
                            width: "12px", height: "12px",
                            borderRadius: "50%",
                            background: PORT_COLORS[port.type],
                            border: "2.5px solid var(--bg-sidebar)",
                            top: `${pct}%`,
                        }}
                    />
                );
            })}

            {/* ↗ Output handles (right side) */}
            {outputs.map((port, i) => {
                const totalPorts = outputs.length;
                const pct = totalPorts === 1 ? 50 : 20 + (60 / (totalPorts - 1)) * i;
                return (
                    <Handle
                        key={port.id}
                        id={port.id}
                        type="source"
                        position={Position.Right}
                        title={`${port.label} (${port.type}): ${port.description}`}
                        style={{
                            width: "12px", height: "12px",
                            borderRadius: "50%",
                            background: PORT_COLORS[port.type],
                            border: "2.5px solid var(--bg-sidebar)",
                            top: `${pct}%`,
                        }}
                    />
                );
            })}

            {/* Main widget content */}
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
                {content}
            </div>

            {/* Settings Drawer */}
            {settingsOpen && (
                <WidgetSettingsDrawer
                    widgetLabel={schema?.displayName ?? widgetType ?? "Widget"}
                    inputs={inputs}
                    outputs={outputs}
                    inputBindings={inputBindings}
                    outputBindings={outputBindings}
                    onDisconnect={handleDisconnect}
                    onClose={() => setSettingsOpen(false)}
                />
            )}
        </div>
    );
};

export default memo(GenericWidgetNode);
