/**
 * widgetSchema.ts
 * Declares the typed input/output port definitions for every widget type.
 * This is the single source of truth for the dataflow system.
 */

// ── Port Types ────────────────────────────────────────────────────────────────

export type PortType = "number" | "string" | "ticker" | "table" | "boolean" | "any";

export interface PortDef {
    id: string;       // Unique handle id, matches ReactFlow handle `id`
    label: string;    // Human-readable label shown on hover
    type: PortType;
    description: string;
}

export interface WidgetSchema {
    widgetType: string;
    displayName: string;
    inputs: PortDef[];
    outputs: PortDef[];
}

// ── Colour mapping for port types ────────────────────────────────────────────

export const PORT_COLORS: Record<PortType, string> = {
    number: "#58a6ff",   // blue
    string: "#8b949e",   // gray
    ticker: "#3fb950",   // green
    table: "#f0883e",   // orange
    boolean: "#bc8cff",  // purple
    any: "#ffffff",   // white
};

// ── Type compatibility ────────────────────────────────────────────────────────
// Returns true if the source type can connect to the target type

export function isCompatible(source: PortType, target: PortType): boolean {
    if (source === "any" || target === "any") return true;
    return source === target;
}

// ── Schema Registry ───────────────────────────────────────────────────────────

const schemas: WidgetSchema[] = [
    {
        widgetType: "network_graph",
        displayName: "Network Graph",
        inputs: [
            { id: "in-data", label: "Graph Data", type: "any", description: "Nodes and edges data" },
        ],
        outputs: [
            { id: "out-selection", label: "Selected Node", type: "string", description: "Currently clicked node ID" },
        ],
    },
    {
        widgetType: "sandbox",
        displayName: "Python Sandbox",
        inputs: [
            { id: "in-a", label: "Input A", type: "any", description: "Variable 'a' injected into Python" },
            { id: "in-b", label: "Input B", type: "any", description: "Variable 'b' injected into Python" },
            { id: "in-c", label: "Input C", type: "any", description: "Variable 'c' injected into Python" },
            { id: "in-d", label: "Input D", type: "any", description: "Variable 'd' injected into Python" },
        ],
        outputs: [
            { id: "out-result", label: "Script Result", type: "any", description: "The final printed or returned value" },
            { id: "out-a", label: "Output A", type: "any", description: "JSON dictionary key 'out-a'" },
            { id: "out-b", label: "Output B", type: "any", description: "JSON dictionary key 'out-b'" },
            { id: "out-c", label: "Output C", type: "any", description: "JSON dictionary key 'out-c'" },
            { id: "out-d", label: "Output D", type: "any", description: "JSON dictionary key 'out-d'" },
        ],
    },
    {
        widgetType: "live_stock",
        displayName: "Live Stock Price",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Stock ticker symbol (e.g. AAPL)" },
        ],
        outputs: [
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "The resolved ticker symbol" },
            { id: "out-price", label: "Price", type: "number", description: "Live price in USD" },
            { id: "out-change", label: "Change", type: "number", description: "Price change from previous close" },
        ],
    },
    {
        widgetType: "preprocessing",
        displayName: "Math Preprocessing",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Stock ticker symbol (e.g. AAPL)" },
            { id: "in-time-period", label: "Period", type: "number", description: "Time period for the calculation" },
        ],
        outputs: [
            { id: "out-result", label: "Result", type: "number", description: "The calculated mathematical indicator" },
            { id: "out-series", label: "Time Series", type: "any", description: "The full temporal array of the indicator" },
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "Pass-through ticker symbol" },
        ],
    },
    {
        widgetType: "computational",
        displayName: "Computational Block",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Stock ticker symbol (e.g. AAPL)" },
            { id: "in-time-period", label: "Period", type: "number", description: "Lookback period for the indicator" },
        ],
        outputs: [
            { id: "out-result", label: "Result", type: "number", description: "The computed indicator value" },
            { id: "out-series", label: "Time Series", type: "any", description: "The aggregated indicator signal array" },
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "Pass-through ticker symbol" },
        ],
    },
    {
        widgetType: "dcf",
        displayName: "DCF Valuation",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
            { id: "in-discount-rate", label: "Discount Rate", type: "number", description: "WACC / discount rate (0–1)" },
            { id: "in-growth-rate", label: "Growth Rate", type: "number", description: "Terminal growth rate (0–1)" },
        ],
        outputs: [
            { id: "out-fair-value", label: "Fair Value", type: "number", description: "Intrinsic value per share" },
            { id: "out-upside", label: "Upside %", type: "number", description: "Upside from current price" },
        ],
    },
    {
        widgetType: "chart",
        displayName: "Price Chart",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Stock ticker to chart" },
            { id: "in-data", label: "Generic Data", type: "any", description: "Feed a time-series line directly into the chart." },
        ],
        outputs: [
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "Pass-through ticker" },
        ],
    },
    {
        widgetType: "table",
        displayName: "Data Table",
        inputs: [
            { id: "in-data", label: "Data", type: "table", description: "Tabular data to display" },
        ],
        outputs: [
            { id: "out-data", label: "Data", type: "table", description: "The rendered table data" },
        ],
    },
    {
        widgetType: "kpi_dashboard",
        displayName: "KPI Dashboard",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
        ],
        outputs: [
            { id: "out-revenue", label: "Revenue", type: "number", description: "Annual revenue" },
            { id: "out-gross-margin", label: "Gross Margin", type: "number", description: "Gross margin %" },
            { id: "out-pe-ratio", label: "P/E Ratio", type: "number", description: "Price-to-earnings ratio" },
        ],
    },
    {
        widgetType: "peer_benchmark",
        displayName: "Peer Benchmarking",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
        ],
        outputs: [
            { id: "out-rank", label: "Peer Rank", type: "number", description: "Rank among peers (1=best)" },
            { id: "out-table", label: "Peers Table", type: "table", description: "Full peer comparison table" },
        ],
    },
    {
        widgetType: "risk_score",
        displayName: "Risk Score",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
        ],
        outputs: [
            { id: "out-score", label: "Risk Score", type: "number", description: "Composite risk score (0–100)" },
            { id: "out-verdict", label: "Verdict", type: "string", description: "Low / Medium / High" },
        ],
    },
    {
        widgetType: "scenario",
        displayName: "Scenario Analysis",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
            { id: "in-growth", label: "Growth %", type: "number", description: "Revenue growth assumption" },
            { id: "in-margin", label: "Margin %", type: "number", description: "Net margin assumption" },
        ],
        outputs: [
            { id: "out-bull", label: "Bull Case", type: "number", description: "Upside target price" },
            { id: "out-base", label: "Base Case", type: "number", description: "Base target price" },
            { id: "out-bear", label: "Bear Case", type: "number", description: "Downside target price" },
        ],
    },
    {
        widgetType: "prediction",
        displayName: "Price Prediction",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
            { id: "in-horizon", label: "Horizon", type: "number", description: "Forecast days" },
        ],
        outputs: [
            { id: "out-target", label: "Target Price", type: "number", description: "Predicted price" },
            { id: "out-signal", label: "Signal", type: "string", description: "BUY / HOLD / SELL" },
        ],
    },
    {
        widgetType: "portfolio_analysis",
        displayName: "Portfolio Analysis",
        inputs: [],
        outputs: [
            { id: "out-total-value", label: "Total Value", type: "number", description: "Portfolio valuation in USD" },
            { id: "out-top-holding", label: "Top Holding", type: "ticker", description: "Largest position ticker" },
        ],
    },
    {
        widgetType: "insider_trading",
        displayName: "Insider Trading",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
        ],
        outputs: [
            { id: "out-sentiment", label: "Sentiment", type: "string", description: "Overall insider sentiment" },
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "Pass-through ticker" },
        ],
    },
    {
        widgetType: "ecosystem",
        displayName: "Ecosystem Map",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
        ],
        outputs: [
            { id: "out-tier-1", label: "Core Subs", type: "string", description: "Primary subsidiaries" },
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "Pass-through ticker" },
        ],
    },
    {
        widgetType: "supply_chain_impact",
        displayName: "Supply Chain",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
        ],
        outputs: [
            { id: "out-risk", label: "Risk Score", type: "number", description: "Supply chain risk/dependency score" },
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "Pass-through ticker" },
        ],
    },
    {
        widgetType: "thesis",
        displayName: "Bull/Bear Thesis",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Company ticker" },
        ],
        outputs: [
            { id: "out-bull", label: "Bull Thesis", type: "string", description: "Long argument" },
            { id: "out-bear", label: "Bear Thesis", type: "string", description: "Short argument" },
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "Pass-through ticker" },
        ],
    },
    {
        widgetType: "custom",
        displayName: "Custom Widget",
        inputs: [
            { id: "in-any", label: "Input", type: "any", description: "Any input data" },
        ],
        outputs: [
            { id: "out-any", label: "Output", type: "any", description: "Any output data" },
        ],
    },
    {
        widgetType: "buy_shares",
        displayName: "Buy Shares",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Stock ticker symbol to buy" },
            { id: "in-quantity", label: "Quantity", type: "number", description: "Number of shares to buy" },
            { id: "in-price", label: "Price", type: "number", description: "Cost basis per share (optional)" },
        ],
        outputs: [
            { id: "out-status", label: "Status", type: "string", description: "Order status (bought / error)" },
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "Pass-through ticker" },
        ],
    },
    {
        widgetType: "sell_shares",
        displayName: "Sell Shares",
        inputs: [
            { id: "in-ticker", label: "Ticker", type: "ticker", description: "Stock ticker symbol to sell" },
            { id: "in-quantity", label: "Quantity", type: "number", description: "Number of shares to sell" },
            { id: "in-price", label: "Price", type: "number", description: "Sale price per share (optional)" },
        ],
        outputs: [
            { id: "out-status", label: "Status", type: "string", description: "Order status (sold / error)" },
            { id: "out-ticker", label: "Ticker", type: "ticker", description: "Pass-through ticker" },
        ],
    },
    {
        widgetType: "conditional",
        displayName: "If / Else",
        inputs: [
            { id: "in-a", label: "A (Left)", type: "any", description: "Left operand of the comparison" },
            { id: "in-b", label: "B (Right)", type: "any", description: "Right operand of the comparison" },
        ],
        outputs: [
            { id: "out-result", label: "Result", type: "boolean", description: "'true' or 'false' string" },
            { id: "out-true-value", label: "True Path", type: "any", description: "Passes A when condition is true" },
            { id: "out-false-value", label: "False Path", type: "any", description: "Passes B when condition is false" },
        ],
    },
    {
        widgetType: "math",
        displayName: "Math Expr",
        inputs: [
            { id: "in-a", label: "A (X Axis)", type: "any", description: "Variable A (scalar or array)" },
            { id: "in-b", label: "B (Y Axis)", type: "any", description: "Variable B (scalar or array)" },
            { id: "in-c", label: "C (Z Axis)", type: "any", description: "Variable C (scalar or array)" },
            { id: "in-d", label: "D (W Axis)", type: "any", description: "Variable D (scalar or array)" },
        ],
        outputs: [
            { id: "out-result", label: "Equation Result", type: "number", description: "Latest aggregated outcome." },
            { id: "out-series", label: "Equation Timeline", type: "any", description: "Timeline plotting outcome." },
        ],
    },
    // VariableNode is special — its schema is dynamic (one output matching its value type)
    {
        widgetType: "variable",
        displayName: "Variable",
        inputs: [
            { id: "var-target", label: "Sync Source", type: "any", description: "Sync value from another variable" },
        ],
        outputs: [
            { id: "var-source", label: "Value", type: "any", description: "Current variable value" },
        ],
    },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getSchema(widgetType: string): WidgetSchema | undefined {
    return schemas.find((s) => s.widgetType === widgetType);
}

export function getAllSchemas(): WidgetSchema[] {
    return schemas;
}
