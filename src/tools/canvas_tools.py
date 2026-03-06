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
    source_port and target_port should be the port IDs as declared in the widget schema
    (e.g. 'out-price', 'in-discount-rate').
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
