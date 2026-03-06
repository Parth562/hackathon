"use client";
/**
 * ConnectionMenu.tsx
 * A floating dropdown that appears when the user drops a connection wire 
 * onto a target node, letting them pick which source output → target input to connect.
 */
import React, { useEffect, useRef } from "react";
import { PortDef, PORT_COLORS, isCompatible } from "@/lib/widgetSchema";

interface Props {
    x: number;
    y: number;
    sourceOutputs: PortDef[];
    targetInputs: PortDef[];
    onConfirm: (sourceHandle: string, targetHandle: string) => void;
    onCancel: () => void;
}

export default function ConnectionMenu({ x, y, sourceOutputs, targetInputs, onConfirm, onCancel }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    // close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onCancel]);

    // Build all compatible (source, target) pairs
    const pairs: { src: PortDef; tgt: PortDef }[] = [];
    for (const src of sourceOutputs) {
        for (const tgt of targetInputs) {
            if (isCompatible(src.type, tgt.type)) {
                pairs.push({ src, tgt });
            }
        }
    }

    return (
        <div
            ref={ref}
            style={{
                position: "fixed",
                left: x,
                top: y,
                zIndex: 9999,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: "10px",
                padding: "8px",
                minWidth: "260px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                backdropFilter: "blur(12px)",
                animation: "fadeIn 0.12s ease",
            }}
        >
            <div style={{
                fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "4px 6px 8px",
                borderBottom: "1px solid var(--border-subtle)",
                marginBottom: "6px",
            }}>
                🔗 Select Connection
            </div>

            {pairs.length === 0 ? (
                <div style={{ padding: "12px 6px", color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "center" }}>
                    No compatible ports found.
                </div>
            ) : (
                pairs.map(({ src, tgt }) => (
                    <button
                        key={`${src.id}--${tgt.id}`}
                        onClick={() => onConfirm(src.id, tgt.id)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            width: "100%",
                            padding: "8px 10px",
                            background: "transparent",
                            border: "none",
                            borderRadius: "7px",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "background 0.15s",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-base)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                        {/* Source port pill */}
                        <span style={{
                            padding: "2px 8px", borderRadius: "20px",
                            fontSize: "0.75rem", fontWeight: 600,
                            background: PORT_COLORS[src.type] + "22",
                            color: PORT_COLORS[src.type],
                            border: `1px solid ${PORT_COLORS[src.type]}44`,
                            whiteSpace: "nowrap",
                        }}>
                            {src.label}
                        </span>

                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>→</span>

                        {/* Target port pill */}
                        <span style={{
                            padding: "2px 8px", borderRadius: "20px",
                            fontSize: "0.75rem", fontWeight: 600,
                            background: PORT_COLORS[tgt.type] + "22",
                            color: PORT_COLORS[tgt.type],
                            border: `1px solid ${PORT_COLORS[tgt.type]}44`,
                            whiteSpace: "nowrap",
                        }}>
                            {tgt.label}
                        </span>

                        <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                            {src.type}
                        </span>
                    </button>
                ))
            )}

            <div style={{ margin: "6px 0 2px", borderTop: "1px solid var(--border-subtle)", paddingTop: "6px" }}>
                <button
                    onClick={onCancel}
                    style={{
                        width: "100%", padding: "6px", background: "transparent", border: "none",
                        color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer",
                        borderRadius: "6px", fontFamily: "var(--font-base)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
