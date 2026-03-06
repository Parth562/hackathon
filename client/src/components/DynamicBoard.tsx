"use client";

import React, { useState, useCallback, useRef } from 'react';
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
    useReactFlow,
    ReactFlowProvider,
    OnConnectStartParams,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import GenericWidgetNode from './GenericWidgetNode';
import VariableNode from './VariableNode';
import ConnectionMenu from './ConnectionMenu';
import { getSchema, PortDef } from '@/lib/widgetSchema';
import { useEffect } from 'react';

interface DynamicBoardProps {
    widgets: any[];
    onRemoveWidget: (id: string) => void;
    sessionId?: string | null;
    pendingActions?: any[];
    onActionsConsumed?: () => void;
}

const nodeTypes = {
    customWidget: GenericWidgetNode,
    variableNode: VariableNode,
};

// ── Connection Menu State ─────────────────────────────────────────────────────
interface PendingConnection {
    x: number;
    y: number;
    sourceId: string;
    targetId: string;
    sourceOutputs: PortDef[];
    targetInputs: PortDef[];
}

// ── Inner board (needs ReactFlowProvider context) ─────────────────────────────
function BoardInner({ widgets, onRemoveWidget, pendingActions = [], onActionsConsumed }: DynamicBoardProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null);
    const connectStartRef = useRef<OnConnectStartParams | null>(null);
    const { getNode } = useReactFlow();

    // ── Edge-driven data propagation ─────────────────────────────────────
    // When a VariableNode output is wired to a widget input port, inject
    // the variable's current value into the widget's widgetData, causing a re-render.
    //
    // Port id → widgetData field mapping (e.g. "in-ticker" → "ticker"):
    useEffect(() => {
        if (edges.length === 0) return;

        // Build a map from variable-source nodeId → { variableName, variableValue }
        const varMap: Record<string, { name: string; value: any }> = {};
        nodes.forEach((n) => {
            if (n.type === 'variableNode') {
                varMap[n.id] = {
                    name: n.data.variableName,
                    value: n.data.variableValue,
                };
            }
        });

        // For every edge from a variableNode to a customWidget, propagate the value
        let changed = false;
        const updatedNodes = nodes.map((n) => {
            if (n.type !== 'customWidget') return n;

            // Find all edges targeting this widget from variable nodes
            const incomingVarEdges = edges.filter(
                (e) => e.target === n.id && !!varMap[e.source]
            );
            if (incomingVarEdges.length === 0) return n;

            let newWidgetData = { ...n.data.widgetData };
            let nodeChanged = false;

            incomingVarEdges.forEach((e) => {
                const varInfo = varMap[e.source];
                const portId = e.targetHandle ?? '';

                // Map port id to actual widgetData field name
                // e.g. "in-ticker" → "ticker", "in-discount-rate" → "discount_rate"
                const fieldName = portId
                    .replace(/^in-/, '')
                    .replace(/-([a-z])/g, (_: string, c: string) => `_${c}`)
                    .replace(/-/g, '_');

                if (fieldName && newWidgetData[fieldName] !== varInfo.value) {
                    newWidgetData[fieldName] = varInfo.value;
                    nodeChanged = true;
                }

                // Also handle a generic "any" port carrying ticker-like values
                if (!fieldName && (portId === '' || portId === 'var-target')) {
                    // Auto-detect by variable name
                    newWidgetData[varInfo.name] = varInfo.value;
                    nodeChanged = true;
                }
            });

            if (!nodeChanged) return n;
            changed = true;
            return {
                ...n,
                data: {
                    ...n.data,
                    widgetData: newWidgetData,
                    // bump a revision counter so child components re-render
                    _rev: (n.data._rev ?? 0) + 1,
                },
            };
        });

        if (changed) {
            setNodes(updatedNodes);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edges, nodes.map(n => n.type === 'variableNode' ? JSON.stringify(n.data) : null).join(',')]);


    useEffect(() => {
        if (!pendingActions || pendingActions.length === 0) return;
        pendingActions.forEach((action) => {
            if (action.type === "set_variable") {
                setNodes((nds: Node[]) =>
                    nds.map((n) =>
                        n.type === "variableNode" && n.data.variableName === action.name
                            ? { ...n, data: { ...n.data, variableValue: action.value } }
                            : n
                    )
                );
            } else if (action.type === "add_edge") {
                setEdges((eds: Edge[]) => addEdge({
                    source: action.sourceId,
                    target: action.targetId,
                    sourceHandle: action.sourceHandle,
                    targetHandle: action.targetHandle,
                    id: `llm-${Date.now()}`,
                    type: "smoothstep",
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--primary)" },
                    style: { stroke: "var(--accent)", strokeWidth: 2 },
                    label: "🤖 auto",
                    labelStyle: { fontSize: 10, fill: "var(--accent)", fontFamily: "var(--font-base)" },
                    labelBgStyle: { fill: "var(--bg-elevated)", fillOpacity: 0.85, rx: 4 },
                } as any, eds));
            } else if (action.type === "remove_edge") {
                setEdges((eds: Edge[]) => eds.filter((e) => e.id !== action.edgeId));
            }
        });
        onActionsConsumed?.();
    }, [pendingActions, onActionsConsumed, setNodes, setEdges]);

    // ── Sync incoming widgets → ReactFlow nodes ───────────────────────────
    useEffect(() => {
        setNodes((nds: Node[]) => {
            const currentIds = new Set(nds.map((n) => n.id));
            const newNodes = [...nds];
            let hasChanges = false;
            let insertionCount = newNodes.length;

            widgets.forEach((w) => {
                if (!w.id) return;
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

    // ── Connection events ─────────────────────────────────────────────────
    const onConnectStart = useCallback((_: any, params: OnConnectStartParams) => {
        connectStartRef.current = params;
    }, []);

    const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
        const startParams = connectStartRef.current;
        if (!startParams) return;

        // Find the target node under the cursor
        const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
        const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;

        const el = document.elementFromPoint(clientX, clientY);
        const nodeEl = el?.closest('[data-id]');
        const targetId = nodeEl?.getAttribute('data-id');

        if (!targetId || targetId === startParams.nodeId) {
            connectStartRef.current = null;
            return;
        }

        const sourceNode = getNode(startParams.nodeId!);
        const targetNode = getNode(targetId);
        if (!sourceNode || !targetNode) { connectStartRef.current = null; return; }

        // Determine widget types
        const getWidgetType = (n: Node) => {
            if (n.type === 'variableNode') return 'variable';
            return n.data?.widgetData?.widget_type || n.data?.widgetData?.type || n.data?.widgetData?.chart_type;
        };

        const srcType = getWidgetType(sourceNode);
        const tgtType = getWidgetType(targetNode);
        const srcSchema = getSchema(srcType ?? "");
        const tgtSchema = getSchema(tgtType ?? "");

        const srcOutputs = startParams.handleType === 'source'
            ? (srcSchema?.outputs ?? [])
            : (srcSchema?.inputs ?? []);
        const tgtInputs = startParams.handleType === 'source'
            ? (tgtSchema?.inputs ?? [])
            : (tgtSchema?.outputs ?? []);

        if (srcOutputs.length === 0 && tgtInputs.length === 0) {
            // No schema — fall back to generic connection
            setEdges((eds) => addEdge({
                source: startParams.nodeId!,
                target: targetId,
                type: 'smoothstep',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
                style: { stroke: 'var(--primary)', strokeWidth: 2 },
            } as any, eds));
            connectStartRef.current = null;
            return;
        }

        // Show port picker if not auto-resolvable
        setPendingConn({
            x: clientX,
            y: clientY,
            sourceId: startParams.nodeId!,
            targetId,
            sourceOutputs: startParams.handleType === 'source' ? srcOutputs : tgtInputs,
            targetInputs: startParams.handleType === 'source' ? tgtInputs : srcOutputs,
        });
        connectStartRef.current = null;
    }, [getNode, setEdges]);

    const handleConnectionConfirm = useCallback((sourceHandle: string, targetHandle: string) => {
        if (!pendingConn) return;
        setEdges((eds) => addEdge({
            source: pendingConn.sourceId,
            target: pendingConn.targetId,
            sourceHandle,
            targetHandle,
            id: `${pendingConn.sourceId}--${sourceHandle}--${pendingConn.targetId}--${targetHandle}`,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
            style: { stroke: 'var(--primary)', strokeWidth: 2 },
            label: `${sourceHandle.replace('out-', '')} → ${targetHandle.replace('in-', '')}`,
            labelStyle: { fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-base)' },
            labelBgStyle: { fill: 'var(--bg-elevated)', fillOpacity: 0.85, rx: 4 },
        } as any, eds));
        setPendingConn(null);
    }, [pendingConn, setEdges]);

    // ── Standard edge connect (when handles directly clicked) ────────────
    const onConnect = useCallback(
        (params: Edge | Connection) => {
            setEdges((eds: Edge[]) => addEdge({
                ...params,
                type: 'smoothstep',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
                style: { stroke: 'var(--primary)', strokeWidth: 2 },
            }, eds));

            // Variable sync
            setNodes((nds: Node[]) => {
                const sourceNode = nds.find((n) => n.id === params.source);
                const targetNode = nds.find((n) => n.id === params.target);
                if (sourceNode?.type === 'variableNode' && targetNode?.type === 'variableNode') {
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

    // ── Add Variable node ─────────────────────────────────────────────────
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
                onConnectStart={onConnectStart as any}
                onConnectEnd={onConnectEnd as any}
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

                <Panel position="top-right">
                    <button
                        onClick={addVariableNode}
                        title="Add a shared variable panel"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                            color: 'var(--text-secondary)', padding: '7px 12px',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 600,
                            fontFamily: 'var(--font-base)', transition: 'all 0.2s ease',
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

            {/* Connection port-picker popup */}
            {pendingConn && (
                <ConnectionMenu
                    x={pendingConn.x}
                    y={pendingConn.y}
                    sourceOutputs={pendingConn.sourceOutputs}
                    targetInputs={pendingConn.targetInputs}
                    onConfirm={handleConnectionConfirm}
                    onCancel={() => setPendingConn(null)}
                />
            )}
        </div>
    );
}

// Wrap in provider so hooks work
export default function DynamicBoard(props: DynamicBoardProps) {
    return (
        <ReactFlowProvider>
            <BoardInner {...props} />
        </ReactFlowProvider>
    );
}
