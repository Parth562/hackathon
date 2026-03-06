"use client";
/**
 * VariableNode.tsx — A ReactFlow node that stores a named variable.
 * Two VariableNodes with the same variable name, connected by an edge,
 * will sync their values: the source propagates to the target.
 */
import React, { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import { Variable as VariableIcon, Trash2 } from "lucide-react";

export interface VariableNodeData {
    variableName: string;
    variableValue: any;      // can be string, number, or object/array
    synced?: boolean;       // true if this node is a sync target
    onChange?: (name: string, value: any) => void;
}

function VariableNode({ data, selected, id }: NodeProps<VariableNodeData>) {
    const { variableName, variableValue, synced, onChange } = data;
    const { setNodes, setEdges } = useReactFlow();

    const handleDelete = useCallback(() => {
        setNodes((nodes) => nodes.filter(n => n.id !== id));
        setEdges((edges) => edges.filter(e => e.source !== id && e.target !== id));
    }, [id, setNodes, setEdges]);

    const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setNodes((nodes) =>
            nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, variableName: newName } } : n)
        );
    }, [id, setNodes]);

    const handleValueChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        const raw = e.target.value;
        const newValue: any = isNaN(Number(raw)) ? raw : Number(raw);
        setNodes((nodes) =>
            nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, variableValue: newValue } } : n)
        );
        if (onChange) onChange(variableName, newValue);
    }, [id, variableName, onChange, setNodes]);

    return (
        <div style={{
            background: selected ? "rgba(88,166,255,0.12)" : "var(--bg-elevated)",
            border: `1px solid ${selected ? "var(--primary)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            minWidth: "200px",
            boxShadow: selected ? "0 0 0 2px rgba(88,166,255,0.25)" : "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
        }}>
            {/* Target handle (left) */}
            <Handle
                type="target"
                position={Position.Left}
                id="var-target"
                style={{
                    width: "10px", height: "10px", borderRadius: "50%",
                    background: synced ? "var(--accent)" : "var(--border-strong)",
                    border: "2px solid var(--bg-base)", left: "-5px",
                }}
            />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <VariableIcon size={14} color="var(--primary)" />
                <span style={{
                    fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.06em"
                }}>
                    Variable
                </span>

                {synced && (
                    <span style={{
                        marginLeft: "auto", fontSize: "0.65rem", fontWeight: 700,
                        color: "var(--accent)", background: "var(--accent-dim)",
                        padding: "1px 6px", borderRadius: "8px"
                    }}>
                        SYNCED
                    </span>
                )}
                <button
                    onClick={handleDelete}
                    style={{
                        marginLeft: synced ? "6px" : "auto", background: "transparent",
                        border: "none", color: "var(--text-muted)", cursor: "pointer",
                        padding: "2px", display: "flex", alignItems: "center"
                    }}
                    title="Delete Variable"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Name input */}
            <div style={{ marginBottom: "8px" }}>
                <label style={{
                    fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600,
                    display: "block", marginBottom: "3px"
                }}>Name</label>
                <input
                    value={variableName}
                    onChange={handleNameChange}
                    placeholder="e.g. discount_rate"
                    disabled={synced}
                    style={{
                        width: "100%", background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)", color: "var(--text-primary)",
                        padding: "5px 8px", borderRadius: "6px", fontSize: "0.82rem",
                        fontFamily: "var(--font-base)",
                        opacity: synced ? 0.6 : 1,
                    }}
                />
            </div>

            <div>
                <label style={{
                    fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600,
                    display: "block", marginBottom: "3px"
                }}>Value</label>
                <input
                    value={String(variableValue)}
                    onChange={handleValueChange}
                    placeholder="0.10"
                    disabled={synced}
                    style={{
                        width: "100%", background: "var(--bg-surface)",
                        border: `1px solid ${synced ? "var(--accent)" : "var(--border-subtle)"}`,
                        color: "var(--text-primary)",
                        padding: "5px 8px", borderRadius: "6px", fontSize: "0.82rem",
                        fontFamily: "monospace",
                    }}
                />
            </div>

            {/* Source handle (right) */}
            <Handle
                type="source"
                position={Position.Right}
                id="var-source"
                style={{
                    width: "10px", height: "10px", borderRadius: "50%",
                    background: "var(--primary)",
                    border: "2px solid var(--bg-base)", right: "-5px",
                }}
            />
        </div>
    );
}

export default memo(VariableNode);
