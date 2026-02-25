"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import ChartWidget from './ChartWidget';
import DcfWidget from './DcfWidget';
import InsiderWidget from './InsiderWidget';
import EcosystemWidget from './EcosystemWidget';
import SupplyChainWidget from './SupplyChainWidget';
import CustomWidget from './CustomWidget';

// Wrapper component that renders the specific widget based on type
const GenericWidgetNode = ({ data, selected }: { data: any, selected: boolean }) => {
    const { widgetData, onRemove } = data;
    
    // We lift the border/selection state to this wrapper so the inner widgets don't need to know about reactflow
    // But we need to handle the resize logic. ReactFlow's NodeResizer handles the interaction, 
    // we just need to make sure our widget fills the space.
    
    const widgetType = widgetData.widget_type || widgetData.type || widgetData.chart_type;

    let content = null;

    // Remove logic is passed down, but the node itself is removed via onNodesChange in the parent
    // The "onClose" prop in our widgets usually triggers onRemoveWidget.
    // We need to bridge this: specific widget calls onClose -> parent removes node.
    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent node selection when clicking close
        if (onRemove) onRemove();
    };

    if (widgetData.chart_type || widgetType === 'chart') {
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
            
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
                {content}
            </div>
            {/* Hidden handles for ReactFlow validity */}
            <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
        </div>
    );
};

export default memo(GenericWidgetNode);
