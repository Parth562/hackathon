"""
canvas_tools.py
LLM-facing tools for reading and mutating the interactive canvas state:
- variables (VariableNodes)
- widget connections (edges)
- widget list
"""
import json
from langchain_core.tools import tool
from typing import Optional

# ── Shared in-memory canvas state ──────────────────────────────────────────────
# Structure: { session_id: { nodes: [...], edges: [...], pending_actions: [...] } }

_canvas_state: dict = {}


def get_session_canvas(session_id: str) -> dict:
    if session_id not in _canvas_state:
        _canvas_state[session_id] = {"nodes": [], "edges": [], "pending_actions": []}
    return _canvas_state[session_id]


def update_canvas_state(session_id: str, nodes: list, edges: list):
    """Called from the API endpoint to keep the in-memory state in sync."""
    state = get_session_canvas(session_id)
    state["nodes"] = nodes
    state["edges"] = edges


def pop_pending_actions(session_id: str) -> list:
    """Drain and return all pending LLM-requested actions."""
    state = get_session_canvas(session_id)
    actions = list(state.get("pending_actions", []))
    state["pending_actions"] = []
    return actions


def _push_action(session_id: str, action: dict):
    state = get_session_canvas(session_id)
    state.setdefault("pending_actions", []).append(action)


# ── Tool: read canvas state ──────────────────────────────────────────────────

@tool
def get_canvas_state(session_id: str) -> str:
    """
    Returns all variable nodes and data widgets currently on the interactive canvas, 
    including their IDs, types, and current variable values. Use this BEFORE 
    making any canvas modifications so you know what's available.
    """
    state = get_session_canvas(session_id)
    nodes = state.get("nodes", [])

    variables = []
    widgets = []

    for n in nodes:
        ntype = n.get("type")
        data = n.get("data", {})
        if ntype == "variableNode":
            variables.append({
                "id": n.get("id"),
                "name": data.get("variableName"),
                "value": data.get("variableValue"),
            })
        elif ntype == "customWidget":
            wdata = data.get("widgetData", {})
            wtype = wdata.get("widget_type") or wdata.get("type") or wdata.get("chart_type")
            widgets.append({
                "id": n.get("id"),
                "widget_type": wtype,
                "ticker": wdata.get("ticker"),
            })

    edges = [
        {
            "id": e.get("id"),
            "from_widget": e.get("source"),
            "from_port": e.get("sourceHandle"),
            "to_widget": e.get("target"),
            "to_port": e.get("targetHandle"),
        }
        for e in state.get("edges", [])
    ]

    result = {
        "variables": variables,
        "widgets": widgets,
        "edges": edges,
    }
    return json.dumps(result, indent=2)


# ── Tool: set variable ────────────────────────────────────────────────────────

@tool
def set_canvas_variable(session_id: str, variable_name: str, new_value: str) -> str:
    """
    Sets a named variable node on the canvas to a new value.
    For example, to change the discount rate for a DCF model, call this with
    variable_name='discount_rate' and new_value='0.12'.
    The change will be reflected immediately on the user's canvas.
    """
    _push_action(session_id, {
        "type": "set_variable",
        "name": variable_name,
        "value": new_value,
    })
    return json.dumps({
        "status": "queued",
        "action": "set_variable",
        "name": variable_name,
        "value": new_value,
    })


# ── Tool: connect widgets ─────────────────────────────────────────────────────

@tool
def connect_canvas_widgets(
    session_id: str,
    source_widget_id: str,
    source_port: str,
    target_widget_id: str,
    target_port: str
) -> str:
    """
    Creates a typed data connection between two widgets on the interactive canvas.
    source_port and target_port should be the EXACT port IDs as declared in the widget schema
    (e.g., 'out-price', 'in-ticker').
    CRITICAL: You MUST use the `list_available_widgets` tool to verify the exact port IDs 
    for each widget before creating a connection. If you guess port names that do not 
    exist on the node (like 'in-data'), the connection will silently fail and be invisible.
    Use get_canvas_state first to find widget IDs.
    """
    _push_action(session_id, {
        "type": "add_edge",
        "sourceId": source_widget_id,
        "sourceHandle": source_port,
        "targetId": target_widget_id,
        "targetHandle": target_port,
    })
    return json.dumps({
        "status": "queued",
        "action": "add_edge",
        "from": f"{source_widget_id}.{source_port}",
        "to": f"{target_widget_id}.{target_port}",
    })


# ── Tool: disconnect widgets ──────────────────────────────────────────────────

@tool
def disconnect_canvas_widgets(session_id: str, edge_id: str) -> str:
    """
    Removes a specific edge (data connection) from the canvas by its edge ID.
    Use get_canvas_state first to find the edge ID you want to remove.
    """
    _push_action(session_id, {
        "type": "remove_edge",
        "edgeId": edge_id,
    })
    return json.dumps({"status": "queued", "action": "remove_edge", "edgeId": edge_id})

# ── Tool: add widget ──────────────────────────────────────────────────────────

@tool
def add_canvas_widget(session_id: str, widget_type: str, arguments: dict = None) -> str:
    """
    Adds a new widget or variable node to the canvas.
    widget_type can be 'variableNode' or 'customWidget'.
    If 'customWidget', arguments should contain 'widget_type' matching one of the supported 
    widgets (e.g., 'live_stock', 'preprocessing', 'computational', 'chart', 'network_graph').
    
    CRITICAL INSTRUCTION FOR DATA FETCHING:
    Do NOT fetch massive historical pricing or indicator arrays to pass into `arguments`! 
    The browser widgets will fetch their own data directly. You must ONLY pass the configuration 
    parameters needed (e.g. `{"widget_type": "preprocessing", "ticker": "AAPL", "function": "SMA"}`).
    
    CRITICAL: PYTHON CODE EXECUTION
    NEVER use this tool to spawn 'code_block', 'sandbox', or Python scripts manually.
    If you need to write and display Python code, you MUST use the `execute_python_code` tool. 
    It will automatically create the UI widget for you.
    
    CRITICAL: Do not invent widget types. Use `list_available_widgets` to find supported ones.
    If 'variableNode', arguments should contain 'variableName' and 'variableValue'.
    """
    import uuid
    new_id = f"{widget_type}-{uuid.uuid4().hex[:8]}"
    
    action = {
        "type": "add_node",
        "node": {
            "id": new_id,
            "type": widget_type,
            "position": {"x": 100, "y": 100}, # Default placement, frontend will layout
            "data": arguments or {}
        }
    }
    
    if widget_type == 'customWidget':
        # Align with frontend expectations where data is nested in widgetData
        action["node"]["data"] = {"widgetData": arguments or {}}
        
    _push_action(session_id, action)
    return json.dumps({
        "status": "queued", 
        "action": "add_node", 
        "nodeId": new_id,
        "type": widget_type
    })

# ── Tool: remove widget ───────────────────────────────────────────────────────

@tool
def remove_canvas_widget(session_id: str, node_id: str) -> str:
    """
    Deletes a specific widget or variable node from the canvas by its node ID.
    Use get_canvas_state first to find the node ID you want to remove.
    """
    _push_action(session_id, {
        "type": "remove_node",
        "nodeId": node_id,
    })
    return json.dumps({"status": "queued", "action": "remove_node", "nodeId": node_id})


# ── Tool: list connections ────────────────────────────────────────────────────

@tool
def list_canvas_connections(session_id: str, node_id: str = None) -> str:
    """
    Lists all data connections (edges) on the canvas.
    If node_id is provided, returns only connections involving that specific node.
    Use this to understand what is connected before making changes.
    """
    state = get_session_canvas(session_id)
    edges = state.get("edges", [])
    result = []
    for e in edges:
        if node_id is None or e.get("source") == node_id or e.get("target") == node_id:
            result.append({
                "edgeId": e.get("id"),
                "from": e.get("source"),
                "fromPort": e.get("sourceHandle"),
                "to": e.get("target"),
                "toPort": e.get("targetHandle"),
            })
    return json.dumps({"connections": result, "total": len(result)}, indent=2)


# ── Tool: update widget data ──────────────────────────────────────────────────

@tool
def update_canvas_widget(session_id: str, node_id: str, updates: dict) -> str:
    """
    Updates the configuration of an existing widget or variable node on the canvas.
    For customWidgets, 'updates' is merged into widgetData (e.g. {"ticker": "MSFT", "operation": "RSI", "time_period": 14}).
    For variableNodes, 'updates' can contain 'variableName' and/or 'variableValue'.
    """
    _push_action(session_id, {
        "type": "update_node",
        "nodeId": node_id,
        "updates": updates,
    })
    return json.dumps({"status": "queued", "action": "update_node", "nodeId": node_id, "updates": updates})


# ── Tool: redirect connection ─────────────────────────────────────────────────

@tool
def redirect_canvas_connection(
    session_id: str,
    old_edge_id: str,
    new_target_widget_id: str,
    new_target_port: str
) -> str:
    """
    Redirects an existing edge to a new target widget+port, keeping the same source.
    Useful for re-routing an analysis output to a different variable or widget.
    Use get_canvas_state to find the edge ID, then call this.
    """
    state = get_session_canvas(session_id)
    edges = state.get("edges", [])
    old_edge = next((e for e in edges if e.get("id") == old_edge_id), None)
    if not old_edge:
        return json.dumps({"error": f"Edge '{old_edge_id}' not found. Call get_canvas_state first."})
    _push_action(session_id, {"type": "remove_edge", "edgeId": old_edge_id})
    _push_action(session_id, {
        "type": "add_edge",
        "sourceId": old_edge.get("source"),
        "sourceHandle": old_edge.get("sourceHandle"),
        "targetId": new_target_widget_id,
        "targetHandle": new_target_port,
    })
    return json.dumps({
        "status": "queued",
        "action": "redirect_edge",
        "from": f"{old_edge.get('source')}.{old_edge.get('sourceHandle')}",
        "to": f"{new_target_widget_id}.{new_target_port}",
    })


# ── Tool: change ticker on a widget ──────────────────────────────────────────

@tool
def set_widget_ticker(session_id: str, node_id: str, ticker: str) -> str:
    """
    Changes the stock ticker on a specific widget (live_stock, computational, preprocessing)
    in real time without removing and re-adding the widget.
    Pass the node_id from get_canvas_state and the new ticker symbol (e.g. 'AAPL', 'MSFT').
    """
    _push_action(session_id, {
        "type": "update_node",
        "nodeId": node_id,
        "updates": {"ticker": ticker},
    })
    return json.dumps({"status": "queued", "action": "set_ticker", "nodeId": node_id, "ticker": ticker})


# ── Tool: buy shares widget ──────────────────────────────────────────────────

@tool
def buy_shares_on_canvas(session_id: str, ticker: str, quantity: float, price: float = 0.0) -> str:
    """
    Spawns a Buy Shares widget on the canvas pre-filled with the given ticker,
    quantity, and optional cost basis price. The user can then confirm the
    purchase visually. Use this when the user asks to add a 'buy' widget.
    """
    import uuid
    new_id = f"customWidget-{uuid.uuid4().hex[:8]}"
    _push_action(session_id, {
        "type": "add_node",
        "node": {
            "id": new_id,
            "type": "customWidget",
            "position": {"x": 200, "y": 200},
            "data": {"widgetData": {
                "widget_type": "buy_shares",
                "ticker": ticker.upper(),
                "quantity": quantity,
                "price": price,
            }}
        }
    })
    return json.dumps({"status": "queued", "action": "add_buy_shares", "nodeId": new_id, "ticker": ticker.upper(), "quantity": quantity})


# ── Tool: sell shares widget ─────────────────────────────────────────────────

@tool
def sell_shares_on_canvas(session_id: str, ticker: str, quantity: float, price: float = 0.0) -> str:
    """
    Spawns a Sell Shares widget on the canvas pre-filled with the given ticker,
    quantity, and optional sale price. The user can then confirm the sale
    visually. Use this when the user asks to add a 'sell' widget.
    """
    import uuid
    new_id = f"customWidget-{uuid.uuid4().hex[:8]}"
    _push_action(session_id, {
        "type": "add_node",
        "node": {
            "id": new_id,
            "type": "customWidget",
            "position": {"x": 200, "y": 350},
            "data": {"widgetData": {
                "widget_type": "sell_shares",
                "ticker": ticker.upper(),
                "quantity": quantity,
                "price": price,
            }}
        }
    })
    return json.dumps({"status": "queued", "action": "add_sell_shares", "nodeId": new_id, "ticker": ticker.upper(), "quantity": quantity})


# ── Tool: conditional / if-else node ─────────────────────────────────────────

@tool
def add_conditional_node(session_id: str, comparator: str = ">") -> str:
    """
    Spawns an If/Else conditional logic node on the canvas.
    The comparator can be '>', '<', '>=', '<=', '==', or '!='.
    This node takes two inputs (A and B), evaluates the condition A {comparator} B,
    and outputs whether the result is 'true' or 'false', plus pass-through values.
    Use this when the user wants to add conditional/branching logic to their canvas.
    """
    valid_ops = ['>', '<', '>=', '<=', '==', '!=']
    if comparator not in valid_ops:
        return json.dumps({"error": f"Invalid comparator '{comparator}'. Use one of: {valid_ops}"})

    import uuid
    new_id = f"customWidget-{uuid.uuid4().hex[:8]}"
    _push_action(session_id, {
        "type": "add_node",
        "node": {
            "id": new_id,
            "type": "customWidget",
            "position": {"x": 300, "y": 200},
            "data": {"widgetData": {
                "widget_type": "conditional",
                "comparator": comparator,
            }}
        }
    })
    return json.dumps({"status": "queued", "action": "add_conditional", "nodeId": new_id, "comparator": comparator})

@tool
def list_available_widgets() -> str:
    """
    Returns a JSON schema of all available widgets and their exact input/output port IDs.
    You MUST use exactly these 'widget_type' strings when adding widgets, 
    and exactly these input/output IDs when connecting widgets.
    """
    schema = [
        {"widget_type": "network_graph", "inputs": ["in-data"], "outputs": ["out-selection"]},
        {"widget_type": "live_stock", "inputs": ["in-ticker"], "outputs": ["out-ticker", "out-price", "out-change"]},
        {"widget_type": "preprocessing", "inputs": ["in-ticker", "in-time-period"], "outputs": ["out-result", "out-series", "out-ticker"]},
        {"widget_type": "computational", "inputs": ["in-ticker", "in-time-period"], "outputs": ["out-result", "out-series", "out-ticker"]},
        {"widget_type": "dcf", "inputs": ["in-ticker", "in-discount-rate", "in-growth-rate"], "outputs": ["out-fair-value", "out-upside"]},
        {"widget_type": "chart", "inputs": ["in-ticker", "in-data"], "outputs": ["out-ticker"]},
        {"widget_type": "table", "inputs": ["in-data"], "outputs": ["out-data"]},
        {"widget_type": "kpi_dashboard", "inputs": ["in-ticker"], "outputs": ["out-revenue", "out-gross-margin", "out-pe-ratio"]},
        {"widget_type": "peer_benchmark", "inputs": ["in-ticker"], "outputs": ["out-rank", "out-table"]},
        {"widget_type": "risk_score", "inputs": ["in-ticker"], "outputs": ["out-score", "out-verdict"]},
        {"widget_type": "scenario", "inputs": ["in-ticker", "in-growth", "in-margin"], "outputs": ["out-bull", "out-base", "out-bear"]},
        {"widget_type": "prediction", "inputs": ["in-ticker", "in-horizon"], "outputs": ["out-target", "out-signal"]},
        {"widget_type": "portfolio_analysis", "inputs": [], "outputs": ["out-total-value", "out-top-holding"]},
        {"widget_type": "insider_trading", "inputs": ["in-ticker"], "outputs": ["out-sentiment", "out-ticker"]},
        {"widget_type": "ecosystem", "inputs": ["in-ticker"], "outputs": ["out-tier-1", "out-ticker"]},
        {"widget_type": "supply_chain_impact", "inputs": ["in-ticker"], "outputs": ["out-risk", "out-ticker"]},
        {"widget_type": "thesis", "inputs": ["in-ticker"], "outputs": ["out-bull", "out-bear", "out-ticker"]},
        {"widget_type": "math", "inputs": ["in-a", "in-b", "in-c", "in-d"], "outputs": ["out-result", "out-series"]},
        {"widget_type": "custom", "inputs": ["in-any"], "outputs": ["out-any"]},
        {"widget_type": "variable", "inputs": ["var-target"], "outputs": ["var-source"]},
        {"widget_type": "buy_shares", "inputs": ["in-ticker", "in-quantity", "in-price"], "outputs": ["out-status", "out-ticker"]},
        {"widget_type": "sell_shares", "inputs": ["in-ticker", "in-quantity", "in-price"], "outputs": ["out-status", "out-ticker"]},
        {"widget_type": "conditional", "inputs": ["in-a", "in-b"], "outputs": ["out-result", "out-true-value", "out-false-value"]},
    ]
    return json.dumps(schema, indent=2)
