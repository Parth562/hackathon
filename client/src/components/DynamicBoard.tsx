"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    ConnectionMode,
    Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import GenericWidgetNode from './GenericWidgetNode';
import VariableNode from './VariableNode';

interface DynamicBoardProps {
    widgets: any[];
    onRemoveWidget: (id: string) => void;
    sessionId?: string | null;
}

const nodeTypes = {
    customWidget: GenericWidgetNode,
    variableNode: VariableNode,
};

export default function DynamicBoard({ widgets, onRemoveWidget }: DynamicBoardProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // ── Sync incoming widgets → ReactFlow nodes ───────────────────────────
    useEffect(() => {
        setNodes((nds: Node[]) => {
            const currentIds = new Set(nds.map((n) => n.id));
            const newNodes = [...nds];
            let hasChanges = false;
            let insertionCount = newNodes.length;

            widgets.forEach((w) => {
                if (!currentIds.has(w.id)) {
                    hasChanges = true;
                    const col = insertionCount % 2;
                    const row = Math.floor(insertionCount / 2);
                    const x = col * 620 + 50;
                    const y = row * 520 + 50;
                    insertionCount++;

                    newNodes.push({
                        id: w.id,
                        type: 'customWidget',
                        position: { x, y },
                        data: {
                            widgetData: w.data,
                            onRemove: () => onRemoveWidget(w.id),
                        },
                        style: (() => {
                            if (w.data?.type === 'table') {
                                const cols = w.data._cols ?? 3;
                                const rows = w.data._rows ?? 4;
                                const w_ = Math.min(Math.max(cols * 160, 360), 900);
                                const h_ = Math.min(Math.max(rows * 42 + 90, 180), 600);
                                return { width: w_, height: h_ };
                            }
                            return { width: 560, height: 460 };
                        })(),
                    });
                }
            });

            const incomingIds = new Set(widgets.map((w) => w.id));
            const activeNodes = newNodes.filter((n) => {
                // Keep variable nodes (added from toolbar, not from widgets prop)
                if (n.type === 'variableNode') return true;
                if (!incomingIds.has(n.id)) { hasChanges = true; return false; }
                return true;
            });

            return hasChanges ? activeNodes : nds;
        });
    }, [widgets, onRemoveWidget, setNodes]);

    // ── Delete node via key ───────────────────────────────────────────────
    const onNodesDelete = useCallback(
        (deleted: any[]) => {
            deleted.forEach((node) => {
                if (node.type !== 'variableNode') onRemoveWidget(node.id);
            });
        },
        [onRemoveWidget]
    );

    // ── Connect edges + variable sync ────────────────────────────────────
    const onConnect = useCallback(
        (params: Edge | Connection) => {
            setEdges((eds: Edge[]) => addEdge({
                ...params,
                type: 'smoothstep',
                animated: true,
                style: { stroke: 'var(--primary)', strokeWidth: 2 },
            }, eds));

            // Variable sync: if both endpoints are variableNodes, mark target as synced
            // and propagate source value to target
            setNodes((nds: Node[]) => {
                const sourceNode = nds.find((n) => n.id === params.source);
                const targetNode = nds.find((n) => n.id === params.target);

                if (
                    sourceNode?.type === 'variableNode' &&
                    targetNode?.type === 'variableNode'
                ) {
                    const srcVal = sourceNode.data.variableValue;
                    const srcName = sourceNode.data.variableName;
                    return nds.map((n) =>
                        n.id === targetNode.id
                            ? { ...n, data: { ...n.data, variableName: srcName, variableValue: srcVal, synced: true } }
                            : n
                    );
                }
                return nds;
            });
        },
        [setEdges, setNodes]
    );

    // ── Add Variable node from toolbar ───────────────────────────────────
    const addVariableNode = useCallback(() => {
        const id = `var-${Date.now()}`;
        const newNode: Node = {
            id,
            type: 'variableNode',
            position: { x: 80 + Math.random() * 200, y: 80 + Math.random() * 200 },
            data: {
                variableName: 'discount_rate',
                variableValue: '0.10',
                synced: false,
                onChange: (name: string, value: string | number) => {
                    // Propagate value change to all synced targets via edges
                    setNodes((nds: Node[]) => nds.map((n) => {
                        if (n.type === 'variableNode' && n.data.synced && n.data.variableName === name) {
                            return { ...n, data: { ...n.data, variableValue: value } };
                        }
                        return n;
                    }));
                },
            },
        };
        setNodes((nds: Node[]) => [...nds, newNode]);
    }, [setNodes]);

    // ── Empty state ───────────────────────────────────────────────────────
    const isEmpty = widgets.length === 0 && !nodes.some((n) => n.type === 'variableNode');

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {isEmpty && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '12px', color: 'var(--text-muted)',
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '16px',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.8rem',
                    }}>📊</div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>
                        Interactive Canvas
                    </h2>
                    <p style={{ fontSize: '0.85rem', maxWidth: '260px', textAlign: 'center', lineHeight: 1.6 }}>
                        Ask the agent to analyse stocks, run DCF models, or benchmark peers — widgets appear here.<br />
                        Use the <strong style={{ color: 'var(--text-secondary)' }}>+ Variable</strong> button to add shared variables.
                    </p>
                </div>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodesDelete={onNodesDelete}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                minZoom={0.1}
                maxZoom={4}
                defaultEdgeOptions={{ type: 'smoothstep' }}
                connectionMode={ConnectionMode.Loose}
                deleteKeyCode={["Backspace", "Delete"]}
                multiSelectionKeyCode={["Control", "Shift"]}
                panOnScroll={true}
                selectionOnDrag={true}
                panOnDrag={[1, 2]}
                fitView={!isEmpty}
            >
                <Background color="#1e2530" gap={24} size={1} />
                <Controls
                    showInteractive={false}
                    style={{
                        display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                    }}
                />

                {/* Canvas toolbar */}
                <Panel position="top-right">
                    <button
                        onClick={addVariableNode}
                        title="Add a shared variable panel"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-secondary)',
                            padding: '7px 12px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-base)',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                        }}
                    >
                        <span>🔗</span> + Variable
                    </button>
                </Panel>
            </ReactFlow>
        </div>
    );
}
