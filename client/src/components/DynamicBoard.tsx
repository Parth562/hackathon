import { Activity, BarChart2, Sigma, TrendingUp, Variable, ShoppingCart, TrendingDown, GitBranch } from 'lucide-react';
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
import dagre from 'dagre';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    dagreGraph.setGraph({ rankdir: direction, ranksep: 180, nodesep: 150 });

    nodes.forEach((node) => {
        const width = (node.style?.width as number) || 400;
        const height = (node.style?.height as number) || 300;
        dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const width = (node.style?.width as number) || 400;
        const height = (node.style?.height as number) || 300;

        return {
            ...node,
            position: {
                x: nodeWithPosition.x - width / 2,
                y: nodeWithPosition.y - height / 2,
            },
        };
    });

    return { nodes: newNodes, edges };
};

interface DynamicBoardProps {
    widgets: any[];
    onRemoveWidget: (id: string) => void;
    sessionId?: string | null;
    pendingActions?: any[];
    onActionsConsumed?: () => void;
    initialNodes?: Node[];
    initialEdges?: Edge[];
    onBoardChange?: (nodes: Node[], edges: Edge[]) => void;
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
function BoardInner({ widgets, onRemoveWidget, pendingActions = [], onActionsConsumed, initialNodes, initialEdges, onBoardChange }: DynamicBoardProps) {
    const augNodes = (initialNodes || []).map(n => n.type === 'customWidget' ? { ...n, data: { ...n.data, onRemove: () => onRemoveWidget(n.id) } } : n);
    const [nodes, setNodes, onNodesChange] = useNodesState(augNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);

    // Trigger board change whenever nodes or edges update
    useEffect(() => {
        if (onBoardChange) onBoardChange(nodes, edges);
    }, [nodes, edges, onBoardChange]);
    const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null);
    const [shouldLayout, setShouldLayout] = useState(false);
    const connectStartRef = useRef<OnConnectStartParams | null>(null);
    const { getNode, setCenter } = useReactFlow();

    // ── Edge-driven data propagation ─────────────────────────────────────
    // Uses functional setNodes to avoid stale-closure race conditions.
    // Fires whenever edges change or any node's outputData / variableData changes.
    useEffect(() => {
        if (edges.length === 0) return;

        setNodes((currentNodes: Node[]) => {
            // Build var map from variableNodes
            const varMap: Record<string, { name: string; value: any }> = {};
            currentNodes.forEach((n) => {
                if (n.type === 'variableNode') {
                    varMap[n.id] = { name: n.data.variableName, value: n.data.variableValue };
                }
            });

            // Build output map from customWidgets (ticker pass-through etc.)
            const widgetOutputMap: Record<string, Record<string, any>> = {};
            currentNodes.forEach((n) => {
                if (n.type === 'customWidget') {
                    const wd = n.data.widgetData || {};
                    const od = n.data.outputData || {};

                    // Unified map of all available data on this node
                    const merged = { ...wd, ...od };

                    widgetOutputMap[n.id] = {
                        ...merged,
                        // Ensure out- prefixed versions exists for common fields
                        'out-ticker': merged.ticker,
                        'out-result': merged.result ?? merged.value,
                        'out-price': merged.price ?? merged.current_price,
                        'out-change': merged.change,
                    };
                }
            });

            let changed = false;

            // FORWARD: (variableNode OR customWidget) → customWidget
            let result = currentNodes.map((n) => {
                if (n.type !== 'customWidget') return n;

                const incomingEdges = edges.filter((e) => e.target === n.id);
                if (incomingEdges.length === 0) return n;

                let newWidgetData = { ...n.data.widgetData };
                let nodeChanged = false;

                incomingEdges.forEach((e) => {
                    const targetPortId = e.targetHandle ?? '';
                    const fieldName = targetPortId
                        .replace(/^in-/, '')
                        .replace(/-/g, '_');

                    // SOURCE: variableNode
                    if (varMap[e.source]) {
                        const varInfo = varMap[e.source];
                        if (fieldName && newWidgetData[fieldName] !== varInfo.value) {
                            newWidgetData[fieldName] = varInfo.value;
                            nodeChanged = true;
                        } else if (!fieldName && (targetPortId === '' || targetPortId === 'var-target')) {
                            newWidgetData[varInfo.name] = varInfo.value;
                            nodeChanged = true;
                        }
                    }

                    // SOURCE: customWidget — pipe via source port handle
                    if (widgetOutputMap[e.source]) {
                        const srcPortId = e.sourceHandle ?? '';
                        const outputs = widgetOutputMap[e.source];
                        const srcField = srcPortId.replace(/^out-/, '').replace(/-/g, '_');
                        const value =
                            outputs[srcPortId] !== undefined ? outputs[srcPortId]
                                : outputs[srcField] !== undefined ? outputs[srcField]
                                    : undefined;

                        if (value !== undefined && fieldName && newWidgetData[fieldName] !== value) {
                            newWidgetData[fieldName] = value;
                            nodeChanged = true;
                        }
                    }
                });

                if (!nodeChanged) return n;
                changed = true;
                return {
                    ...n,
                    data: { ...n.data, widgetData: newWidgetData, _rev: (n.data._rev ?? 0) + 1 },
                };
            });

            // REVERSE: (customWidget | variableNode) → variableNode
            result = result.map((n) => {
                if (n.type !== 'variableNode') return n;

                const incomingEdges = edges.filter(e => e.target === n.id);
                if (incomingEdges.length === 0) {
                    if (n.data.synced) { changed = true; return { ...n, data: { ...n.data, synced: false } }; }
                    return n;
                }

                let newValue = n.data.variableValue;
                let newName = n.data.variableName;
                let nodeChanged = false;

                incomingEdges.forEach((e) => {
                    const sourceNode = result.find(src => src.id === e.source);

                    if (sourceNode?.type === 'variableNode') {
                        if (sourceNode.data.variableValue !== newValue || sourceNode.data.variableName !== newName) {
                            newValue = sourceNode.data.variableValue;
                            newName = sourceNode.data.variableName;
                            nodeChanged = true;
                        }
                    } else if (sourceNode?.type === 'customWidget') {
                        const portId = e.sourceHandle ?? '';
                        const fieldName = portId.replace(/^out-/, '').replace(/-/g, '_');
                        const od = sourceNode.data.outputData || {};
                        const wd = sourceNode.data.widgetData || {};

                        // Try outputData first, then widgetData
                        const combined: Record<string, any> = {
                            ...wd, ...od,
                            'out-ticker': wd.ticker, 'out-result': od.result ?? od.value,
                            ticker: wd.ticker, result: od.result ?? od.value,
                        };
                        const val =
                            combined[portId] !== undefined ? combined[portId]
                                : combined[fieldName] !== undefined ? combined[fieldName]
                                    : undefined;

                        if (val !== undefined && val !== newValue) {
                            newValue = val;
                            nodeChanged = true;
                        }
                    }
                });

                if (!nodeChanged && n.data.synced === true) return n;
                changed = true;
                return { ...n, data: { ...n.data, variableName: newName, variableValue: newValue, synced: true } };
            });

            return changed ? result : currentNodes;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edges, nodes.map(n => JSON.stringify(n.data)).join('|')]);



    useEffect(() => {
        if (!pendingActions || pendingActions.length === 0) return;
        let needsLayout = false;
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
                needsLayout = true;
                setEdges((eds: Edge[]) => addEdge({
                    source: action.sourceId,
                    target: action.targetId,
                    sourceHandle: action.sourceHandle,
                    targetHandle: action.targetHandle,
                    id: `llm-${action.sourceId}-${action.targetId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    type: "smoothstep",
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--primary)" },
                    style: { stroke: "var(--primary)", strokeWidth: 2 },
                    label: `${(action.sourceHandle || '').replace('out-', '')} → ${(action.targetHandle || '').replace('in-', '')}`,
                    labelStyle: { fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-base)" },
                    labelBgStyle: { fill: "var(--bg-elevated)", fillOpacity: 0.85, rx: 4 },
                } as any, eds));
            } else if (action.type === "remove_edge") {
                setEdges((eds: Edge[]) => eds.filter((e) => e.id !== action.edgeId));
            } else if (action.type === "add_node") {
                needsLayout = true;
                setNodes((nds: Node[]) => [...nds, action.node as Node]);
            } else if (action.type === "remove_node") {
                setNodes((nds: Node[]) => nds.filter((n) => n.id !== action.nodeId));
                setEdges((eds: Edge[]) => eds.filter(e => e.source !== action.nodeId && e.target !== action.nodeId));
            } else if (action.type === "update_node") {
                setNodes((nds: Node[]) => nds.map((n) => {
                    if (n.id !== action.nodeId) return n;
                    if (n.type === 'variableNode') {
                        return { ...n, data: { ...n.data, ...action.updates } };
                    }
                    // customWidget — merge into widgetData
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            widgetData: { ...(n.data.widgetData || {}), ...action.updates },
                        }
                    };
                }));
            }
        });
        if (needsLayout) {
            setShouldLayout(true);
        }
        onActionsConsumed?.();
    }, [pendingActions, onActionsConsumed, setNodes, setEdges]);

    // Layout effect triggered after states update
    useEffect(() => {
        if (shouldLayout && nodes.length > 0) {
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
            setShouldLayout(false);
        }
    }, [shouldLayout, nodes, edges, setNodes, setEdges]);

    // ── Auto-pan to new widgets ───────────────────────────────────────────
    const prevNodeCountRef = useRef(nodes.length);

    useEffect(() => {
        if (nodes.length > prevNodeCountRef.current) {
            // Find the most recently added node
            const latestNode = nodes[nodes.length - 1];
            if (latestNode && latestNode.position) {
                // Determine approximate center of the new node based on its style width/height if available
                const w = (latestNode.style?.width as number) || 400;
                const h = (latestNode.style?.height as number) || 300;

                // Add a small delay so ReactFlow finishes rendering the new node into the DOM
                setTimeout(() => {
                    setCenter(
                        latestNode.position.x + (w / 2),
                        latestNode.position.y + (h / 2) - 50, // slightly offset Y so it's not squished at the top
                        { zoom: 0.8, duration: 800 }
                    );
                }, 50);
            }
        }
        prevNodeCountRef.current = nodes.length;
    }, [nodes, setCenter]);

    // ── Sync incoming widgets → ReactFlow nodes ───────────────────────────
    useEffect(() => {
        if (!widgets || widgets.length === 0) return;
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

            return hasChanges ? newNodes : nds;
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
        // Find the closest DOM element that is a ReactFlow node
        const nodeEl = el?.closest('.react-flow__node');
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

        let finalSrcOutputs = startParams.handleType === 'source' ? srcOutputs : tgtInputs;
        let finalTgtInputs = startParams.handleType === 'source' ? tgtInputs : srcOutputs;

        if (finalSrcOutputs.length === 0) {
            finalSrcOutputs = [{ id: 'out-any', label: 'Output', type: 'any', description: 'Generic output' }];
        }
        if (finalTgtInputs.length === 0) {
            finalTgtInputs = [{ id: 'in-any', label: 'Input', type: 'any', description: 'Generic input' }];
        }

        // Show port picker if not auto-resolvable
        setPendingConn({
            x: clientX,
            y: clientY,
            sourceId: startParams.nodeId!,
            targetId,
            sourceOutputs: finalSrcOutputs,
            targetInputs: finalTgtInputs,
        });
        connectStartRef.current = null;
    }, [getNode, setEdges]);

    const handleConnectionConfirm = useCallback((sourceHandle: string, targetHandle: string) => {
        if (!pendingConn) return;
        setEdges((eds: Edge[]) => addEdge({
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

        // Variable sync
        setNodes((nds: Node[]) => {
            const src = nds.find((n) => n.id === pendingConn.sourceId);
            const tgt = nds.find((n) => n.id === pendingConn.targetId);
            if (src?.type === 'variableNode' && tgt?.type === 'variableNode') {
                const srcVal = src.data.variableValue;
                const srcName = src.data.variableName;
                return nds.map((n) =>
                    n.id === tgt.id
                        ? { ...n, data: { ...n.data, variableName: srcName, variableValue: srcVal, synced: true } }
                        : n
                );
            }
            return nds;
        });

        setPendingConn(null);
    }, [pendingConn, setEdges, setNodes]);

    // ── Standard edge connect (when handles directly clicked) ────────────
    const onConnect = useCallback(
        (params: Edge | Connection) => {
            // Do nothing here to prevent automatic edges forming immediately.
            // onConnectEnd will immediately fire afterward, pick up the target node under the mouse,
            // and display the ConnectionMenu dropdown. This forces the user to explicitly handle it and prevents the ghost blue line.
        },
        []
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

    // ── Add Computational Block ──────────────────────────────────────────
    const addComputationalNode = useCallback((widgetType: string) => {
        const id = `${widgetType}-${Date.now()}`;
        const newNode: Node = {
            id,
            type: 'customWidget',
            position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 300 },
            style: { width: 520, height: 440 },
            data: {
                widgetData: { widget_type: widgetType, operation: 'SMA', time_period: 20, interval: 'daily', series_type: 'close' },
                onRemove: () => setNodes((nds: Node[]) => nds.filter(n => n.id !== id)),
            },
        };
        setNodes((nds: Node[]) => [...nds, newNode]);
    }, [setNodes]);

    // ── Add Live Stock Block ─────────────────────────────────────────────
    const addLiveStockNode = useCallback(() => {
        const id = `live_stock-${Date.now()}`;
        const newNode: Node = {
            id,
            type: 'customWidget',
            position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 300 },
            style: { width: 420, height: 360 },
            data: {
                widgetData: { widget_type: 'live_stock', ticker: 'AAPL' },
                onRemove: () => setNodes((nds: Node[]) => nds.filter(n => n.id !== id)),
            },
        };
        setNodes((nds: Node[]) => [...nds, newNode]);
    }, [setNodes]);

    // ── Add Trading / Logic Blocks ─────────────────────────────────────
    const addActionNode = useCallback((widgetType: string) => {
        const id = `${widgetType}-${Date.now()}`;
        const newNode: Node = {
            id,
            type: 'customWidget',
            position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
            style: { width: widgetType === 'conditional' ? 380 : 320, height: widgetType === 'conditional' ? 240 : 340 },
            data: {
                widgetData: { widget_type: widgetType },
                onRemove: () => setNodes((nds: Node[]) => nds.filter(n => n.id !== id)),
            },
        };
        setNodes((nds: Node[]) => [...nds, newNode]);
    }, [setNodes]);

    const [paletteOpen, setPaletteOpen] = useState<boolean>(false);

    // Row button style for palette items
    const rowStyle: React.CSSProperties = {
        display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center',
        padding: '7px 12px', background: 'transparent',
        border: 'none', color: 'var(--text-secondary)',
        fontSize: '0.82rem', cursor: 'pointer',
        borderRadius: '6px', fontFamily: 'var(--font-base)',
        transition: 'background 0.15s, color 0.15s',
    };

    const isEmpty = nodes.length === 0;

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
                    }}><BarChart2 size={28} /></div>
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
                connectionRadius={40}
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
                    className="custom-flow-controls"
                />

                <Panel position="top-right">
                    <div style={{ position: 'relative', display: 'flex', gap: '6px', alignItems: 'center' }}>

                        {/* Block palette toggle */}
                        <button
                            onClick={() => setPaletteOpen(o => !o)}
                            title="Add blocks"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: paletteOpen ? 'var(--primary)' : 'var(--bg-elevated)',
                                border: '1px solid var(--border-default)',
                                color: paletteOpen ? '#fff' : 'var(--text-secondary)',
                                padding: '7px 12px',
                                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 600,
                                fontFamily: 'var(--font-base)', transition: 'all 0.15s ease',
                            }}
                        >
                            <span>⊕</span> Add Block
                        </button>

                        {/* Variable button always visible */}
                        <button
                            onClick={addVariableNode}
                            title="Add a variable node"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)', padding: '7px 10px',
                                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 600,
                                fontFamily: 'var(--font-base)', transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                        >
                            <Variable size={16} />
                            Variable
                        </button>

                        {/* Palette dropdown */}
                        {paletteOpen && (
                            <div style={{
                                position: 'absolute', top: '110%', right: 0,
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '10px', padding: '8px',
                                minWidth: '240px', zIndex: 9999,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '4px 8px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data & Action Blocks</div>
                                {[{ label: 'Live Stock Price', icon: <TrendingUp size={14} style={{ marginRight: 6 }} />, fn: addLiveStockNode }].map(item => (
                                    <button key={item.label} onClick={() => { item.fn(); setPaletteOpen(false); }} style={rowStyle}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                                        {item.icon} {item.label}
                                    </button>
                                ))}
                                <button onClick={() => { addActionNode('buy_shares'); setPaletteOpen(false); }} style={rowStyle}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = '#3fb950'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                                    <ShoppingCart size={14} style={{ marginRight: 6 }} /> Buy Shares
                                </button>
                                <button onClick={() => { addActionNode('sell_shares'); setPaletteOpen(false); }} style={rowStyle}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = '#f85149'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                                    <TrendingDown size={14} style={{ marginRight: 6 }} /> Sell Shares
                                </button>

                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '10px 8px 6px', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}>Computational & Logic</div>
                                <button onClick={() => { addActionNode('conditional'); setPaletteOpen(false); }} style={rowStyle}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = '#bc8cff'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                                    <GitBranch size={14} style={{ marginRight: 6 }} /> If / Else
                                </button>
                                {[
                                    { label: 'Computational (Trend/RSI/etc)', type: 'computational', icon: <Activity size={14} style={{ marginRight: 6 }} /> },
                                    { label: 'Preprocessing (SMA/EMA)', type: 'preprocessing', icon: <Sigma size={14} style={{ marginRight: 6 }} /> },
                                ].map(item => (
                                    <button key={item.type} onClick={() => { addComputationalNode(item.type); setPaletteOpen(false); }} style={rowStyle}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                                    >{item.icon} {item.label}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </Panel>
            </ReactFlow>

            {/* Connection port-picker popup */}
            {
                pendingConn && (
                    <ConnectionMenu
                        x={pendingConn.x}
                        y={pendingConn.y}
                        sourceOutputs={pendingConn.sourceOutputs}
                        targetInputs={pendingConn.targetInputs}
                        onConfirm={handleConnectionConfirm}
                        onCancel={() => setPendingConn(null)}
                    />
                )
            }
        </div >
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
