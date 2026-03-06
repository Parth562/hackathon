"use client";
import React from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "./ui/Badge";

interface Props { data: any; onClose: () => void; }

function ConfidenceMeter({ value, color }: { value: number; color: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
            <div style={{ flex: 1, height: "6px", background: "var(--bg-surface)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{
                    width: `${value}%`, height: "100%", background: color, borderRadius: "3px",
                    transition: "width 0.8s ease"
                }} />
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color, minWidth: "32px" }}>{value}%</span>
        </div>
    );
}

export default function ThesisWidget({ data, onClose }: Props) {
    if (data.error) return (
        <div className="glass-panel" style={{ borderLeft: "3px solid var(--red)" }}>
            <p style={{ color: "var(--red)" }}>{data.error}</p>
        </div>
    );

    const verdictColor = data.verdict_color === "green" ? "var(--green)"
        : data.verdict_color === "red" ? "var(--red)" : "var(--amber)";

    return (
        <div className="glass-panel" style={{ position: "relative", height: "100%", overflow: "auto" }}>
            <button onClick={onClose} style={{
                position: "absolute", top: 12, right: 14, background: "none", border: "none",
                color: "var(--text-muted)", cursor: "pointer",
            }}><X size={16} /></button>

            {/* Header */}
            <div style={{ marginBottom: 16, paddingRight: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{data.ticker}</span>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{data.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Verdict:</span>
                    <span style={{ fontWeight: 700, color: verdictColor, fontSize: "0.9rem" }}>
                        {data.verdict}
                    </span>
                </div>
                {data.current_price && data.analyst_target && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
                        Current ${data.current_price.toFixed(2)} · Analyst target ${data.analyst_target.toFixed(2)}
                    </div>
                )}
            </div>

            {/* Two columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {/* Bull */}
                <div style={{
                    background: "var(--green-dim)",
                    border: "1px solid rgba(63,185,80,0.2)",
                    borderRadius: "var(--radius-md)",
                    padding: "14px",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <TrendingUp size={16} color="var(--green)" />
                        <span style={{ fontWeight: 700, color: "var(--green)", fontSize: "0.9rem" }}>Bull Case</span>
                    </div>
                    <ul style={{ paddingLeft: "1.2em", display: "flex", flexDirection: "column", gap: 6 }}>
                        {(data.bull?.catalysts ?? []).map((c: string, i: number) => (
                            <li key={i} style={{ fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.5 }}>{c}</li>
                        ))}
                    </ul>
                    <ConfidenceMeter value={data.bull?.confidence ?? 50} color="var(--green)" />
                </div>

                {/* Bear */}
                <div style={{
                    background: "var(--red-dim)",
                    border: "1px solid rgba(248,81,73,0.2)",
                    borderRadius: "var(--radius-md)",
                    padding: "14px",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <TrendingDown size={16} color="var(--red)" />
                        <span style={{ fontWeight: 700, color: "var(--red)", fontSize: "0.9rem" }}>Bear Case</span>
                    </div>
                    <ul style={{ paddingLeft: "1.2em", display: "flex", flexDirection: "column", gap: 6 }}>
                        {(data.bear?.catalysts ?? []).map((c: string, i: number) => (
                            <li key={i} style={{ fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.5 }}>{c}</li>
                        ))}
                    </ul>
                    <ConfidenceMeter value={data.bear?.confidence ?? 50} color="var(--red)" />
                </div>
            </div>
        </div>
    );
}
