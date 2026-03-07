/**
 * canvasConfig.ts
 * -----------------------------------------------------------------------
 * The single source-of-truth for the canvas layout model.
 * This config is what gets passed to the LLM for analytics automation.
 *
 * Use `buildCanvasConfig(nodes, edges)` to produce a typed snapshot that
 * the agent can read, reason about, and modify via canvas tools.
 */

import type { Node, Edge } from 'reactflow';

// ── Port types ────────────────────────────────────────────────────────────────

export type PortType = 'ticker' | 'number' | 'string' | 'table' | 'boolean' | 'any';

export interface CanvasPort {
    id: string;
    label: string;
    type: PortType;
}

// ── Widget configs ───────────────────────────────────────────────────────────

export interface VariableNodeConfig {
    kind: 'variable';
    nodeId: string;
    name: string;
    value: string | number | null;
}

export interface LiveStockConfig {
    kind: 'live_stock';
    nodeId: string;
    ticker: string;
}

export interface ComputationalConfig {
    kind: 'computational' | 'preprocessing';
    nodeId: string;
    ticker?: string;
    operation: string;       // SMA, EMA, RSI, MACD, BBANDS, ATR …
    time_period: number;
    interval: string;
    series_type: string;
    latestValue?: number;
}

export interface GenericWidgetConfig {
    kind: string;
    nodeId: string;
    widget_type: string;
    ticker?: string;
    [key: string]: any;
}

export type CanvasNodeConfig =
    | VariableNodeConfig
    | LiveStockConfig
    | ComputationalConfig
    | GenericWidgetConfig;

// ── Edge config ───────────────────────────────────────────────────────────────

export interface CanvasEdgeConfig {
    edgeId: string;
    sourceNodeId: string;
    sourcePort: string;
    targetNodeId: string;
    targetPort: string;
}

// ── Full canvas config ────────────────────────────────────────────────────────

export interface CanvasConfig {
    sessionId?: string;
    nodes: CanvasNodeConfig[];
    edges: CanvasEdgeConfig[];
    /** Derived helper: map nodeId → CanvasNodeConfig */
    nodeById: Record<string, CanvasNodeConfig>;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildCanvasConfig(nodes: Node[], edges: Edge[], sessionId?: string): CanvasConfig {
    const nodeConfigs: CanvasNodeConfig[] = nodes.map((n) => {
        if (n.type === 'variableNode') {
            return {
                kind: 'variable',
                nodeId: n.id,
                name: n.data?.variableName ?? '',
                value: n.data?.variableValue ?? null,
            } as VariableNodeConfig;
        }

        const wd = n.data?.widgetData ?? {};
        const wt: string = wd.widget_type ?? wd.type ?? '';

        if (wt === 'live_stock') {
            return { kind: 'live_stock', nodeId: n.id, ticker: wd.ticker ?? '' } as LiveStockConfig;
        }

        if (wt === 'computational' || wt === 'preprocessing') {
            return {
                kind: wt,
                nodeId: n.id,
                ticker: wd.ticker,
                operation: wd.operation ?? wd.function ?? 'SMA',
                time_period: wd.time_period ?? 20,
                interval: wd.interval ?? 'daily',
                series_type: wd.series_type ?? 'close',
            } as ComputationalConfig;
        }

        return { kind: 'widget', nodeId: n.id, widget_type: wt, ...wd } as GenericWidgetConfig;
    });

    const edgeConfigs: CanvasEdgeConfig[] = edges.map((e) => ({
        edgeId: e.id,
        sourceNodeId: e.source,
        sourcePort: e.sourceHandle ?? '',
        targetNodeId: e.target,
        targetPort: e.targetHandle ?? '',
    }));

    const nodeById = Object.fromEntries(nodeConfigs.map((nc) => [nc.nodeId, nc]));

    return { sessionId, nodes: nodeConfigs, edges: edgeConfigs, nodeById };
}

// ── JSON serialiser for LLM ingestion ─────────────────────────────────────────

export function canvasConfigToLLMPayload(config: CanvasConfig): string {
    const { nodeById: _, ...rest } = config;
    return JSON.stringify(rest, null, 2);
}
