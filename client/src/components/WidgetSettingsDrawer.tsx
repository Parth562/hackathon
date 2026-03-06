"use client";
/**
 * WidgetSettingsDrawer.tsx
 * A slide-in overlay per widget showing its declared input/output ports,
 * current edge bindings, and allowing the user to disconnect edges.
 */
import React from "react";
import { Settings, X, ArrowRight, Circle } from "lucide-react";
import { PortDef, PORT_COLORS } from "@/lib/widgetSchema";

export interface EdgeBinding {
    edgeId: string;
    portId: string;
    remoteLabel: string;  // label from the other end
}

interface Props {
    widgetLabel: string;
    inputs: PortDef[];
    outputs: PortDef[];
    inputBindings: EdgeBinding[];   // currently connected input edges
    outputBindings: EdgeBinding[];  // currently connected output edges
    onDisconnect: (edgeId: string) => void;
    onClose: () => void;
}

function PortRow({ port, binding, onDisconnect }: {
    port: PortDef;
    binding?: EdgeBinding;
    onDisconnect?: (edgeId: string) => void;
}) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "8px 12px",
            background: binding ? "var(--bg-surface)" : "transparent",
            borderRadius: "8px",
            border: binding ? "1px solid var(--border-subtle)" : "1px solid transparent",
            marginBottom: "4px",
            transition: "background 0.15s",
        }}>
            <Circle
                size={10}
                fill={PORT_COLORS[port.type]}
                stroke={PORT_COLORS[port.type]}
                style={{ flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {port.label}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {binding ? (
                        <span style={{ color: "var(--accent)" }}>← {binding.remoteLabel}</span>
                    ) : (
                        port.description
                    )}
                </div>
            </div>
            <span style={{
                padding: "1px 7px", borderRadius: "20px", fontSize: "0.65rem", fontWeight: 700,
                background: PORT_COLORS[port.type] + "22",
                color: PORT_COLORS[port.type],
                border: `1px solid ${PORT_COLORS[port.type]}33`,
                flexShrink: 0,
            }}>
                {port.type}
            </span>
            {binding && onDisconnect && (
                <button
                    onClick={() => onDisconnect(binding.edgeId)}
                    title="Disconnect"
                    style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-muted)", padding: "2px", lineHeight: 1,
                        borderRadius: "4px", flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#f85149")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                    <X size={13} />
                </button>
            )}
        </div>
    );
}

export default function WidgetSettingsDrawer({
    widgetLabel,
    inputs,
    outputs,
    inputBindings,
    outputBindings,
    onDisconnect,
    onClose,
}: Props) {
    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: "fixed", inset: 0, zIndex: 3999,
                    background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)",
                }}
            />

            {/* Drawer */}
            <div style={{
                position: "fixed", right: 0, top: 0, bottom: 0,
                width: "320px", zIndex: 4000,
                background: "var(--bg-sidebar)",
                borderLeft: "1px solid var(--border-subtle)",
                display: "flex", flexDirection: "column",
                boxShadow: "-12px 0 40px rgba(0,0,0,0.4)",
                animation: "slideInRight 0.2s ease",
            }}>
                {/* Header */}
                <div style={{
                    padding: "16px 18px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex", alignItems: "center", gap: "10px",
                }}>
                    <Settings size={16} color="var(--primary)" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                            Widget Settings
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {widgetLabel}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--text-muted)", padding: "4px", borderRadius: "6px",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                    {/* Inputs */}
                    {inputs.length > 0 && (
                        <section style={{ marginBottom: "20px" }}>
                            <div style={{
                                fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)",
                                textTransform: "uppercase", letterSpacing: "0.08em",
                                marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px",
                            }}>
                                <ArrowRight size={11} /> Inputs
                            </div>
                            {inputs.map((port) => (
                                <PortRow
                                    key={port.id}
                                    port={port}
                                    binding={inputBindings.find((b) => b.portId === port.id)}
                                    onDisconnect={onDisconnect}
                                />
                            ))}
                        </section>
                    )}

                    {/* Outputs */}
                    {outputs.length > 0 && (
                        <section>
                            <div style={{
                                fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)",
                                textTransform: "uppercase", letterSpacing: "0.08em",
                                marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px",
                            }}>
                                <ArrowRight size={11} style={{ transform: "scaleX(-1)" }} /> Outputs
                            </div>
                            {outputs.map((port) => (
                                <PortRow
                                    key={port.id}
                                    port={port}
                                    binding={outputBindings.find((b) => b.portId === port.id)}
                                    onDisconnect={onDisconnect}
                                />
                            ))}
                        </section>
                    )}

                    {inputs.length === 0 && outputs.length === 0 && (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "24px" }}>
                            No port schema defined for this widget type.
                        </div>
                    )}
                </div>

                <div style={{
                    padding: "12px 16px",
                    borderTop: "1px solid var(--border-subtle)",
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                }}>
                    🔗 Drag handles to connect ports. The LLM can also create connections for you automatically.
                </div>
            </div>
        </>
    );
}
