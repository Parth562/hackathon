"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  applyNodeChanges,
  NodeChange,
  ConnectionMode
} from 'reactflow';
import 'reactflow/dist/style.css';

import GenericWidgetNode from './GenericWidgetNode';

interface DynamicBoardProps {
    widgets: any[];
    onRemoveWidget: (id: string) => void;
}

const nodeTypes = {
  customWidget: GenericWidgetNode,
};

export default function DynamicBoard({ widgets, onRemoveWidget }: DynamicBoardProps) {
    // Initial nodes/edges state
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Sync incoming widgets with ReactFlow nodes
    useEffect(() => {
        setNodes((nds) => {
            const currentIds = new Set(nds.map((n) => n.id));
            const newNodes = [...nds];
            let hasChanges = false;
            
            widgets.forEach((w, index) => {
                // If this widget isn't already a node, add it
                if (!currentIds.has(w.id)) {
                    hasChanges = true;
                    // Simple auto-layout: 2 columns 
                    // x,y logic: (idx % 2 * 600), (floor(idx / 2) * 500)
                    const x = (index % 2) * 600 + 50; 
                    const y = Math.floor(index / 2) * 500 + 50;

                    newNodes.push({
                        id: w.id,
                        type: 'customWidget',
                        position: { x, y },
                        data: { 
                            widgetData: w.data, 
                            onRemove: () => onRemoveWidget(w.id) 
                        },
                        // Default size so the resizer knows where handles start
                        style: { width: 550, height: 450 }, 
                        dragHandle: '.drag-handle', // allow dragging only by header
                    });
                }
            });

            // If a widget was removed from parent props, remove from nodes
            const incomingIds = new Set(widgets.map((w) => w.id));
            const activeNodes = newNodes.filter((n) => {
                if (!incomingIds.has(n.id)) {
                    hasChanges = true;
                    return false; // remove it
                }
                return true; // keep it
            });

            return hasChanges ? activeNodes : nds;
        });
    }, [widgets, onRemoveWidget, setNodes]);

    // Handle node deletion via Backspace/Delete key in ReactFlow
    const onNodesDelete = useCallback(
        (deleted: any[]) => {
            deleted.forEach((node) => {
                onRemoveWidget(node.id);
            });
        },
        [onRemoveWidget]
    );

    if (widgets.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8b949e' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#fff' }}>Interactive Canvas</h2>
                <p>Ask the agent to generate a graph or DCF model, and it will appear here.</p>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodesDelete={onNodesDelete}
                nodeTypes={nodeTypes}
                minZoom={0.1}
                maxZoom={4}
                defaultEdgeOptions={{ type: 'smoothstep' }}
                connectionMode={ConnectionMode.Loose}
                deleteKeyCode={["Backspace", "Delete"]}
                multiSelectionKeyCode={["Control", "Shift"]}
                selectionKeyCode={["Shift"]}
                panOnScroll={true} 
                selectionOnDrag={true} 
                panOnDrag={[1, 2]} 
                fitView
            >
                <Background color="#30363d" gap={20} size={1} />
                <Controls showInteractive={false} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', background: 'rgba(13, 17, 23, 0.8)', border: '1px solid #30363d', borderRadius: '8px' }} />
            </ReactFlow>
        </div>
    );
}
