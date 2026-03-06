"use client";
import React from "react";
import { X } from "lucide-react";
import { Badge } from "./ui/Badge";

interface Props { data: any; onClose: () => void; }

const COLORS: Record<string, string> = {
    positive: "var(--green)",
    negative: "var(--red)",
    neutral: "var(--text-secondary)",
};

function KpiCard({ label, value }: { label: string; value: string }) {
    const isNum = value !== "N/A";
    const neg = isNum && (value.includes("-") || (label.includes("Debt") && parseFloat(value) > 200));
    const pos = isNum && !neg && value !== "0.00";
    return (
        <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 14px",
        }}>
            <div style={{
                fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px"
            }}>{label}</div>
            <div style={{
                fontSize: "1.1rem", fontWeight: 700,
                color: neg ? "var(--red)" : pos ? "var(--green)" : "var(--text-primary)"
            }}>
                {value}
            </div>
        </div>
    );
}

export default function KpiDashboardWidget({ data, onClose }: Props) {
    if (data.error) return (
        <div className="glass-panel" style={{ borderLeft: "3px solid var(--red)" }}>
            <p style={{ color: "var(--red)" }}>{data.error}</p>
        </div>
    );

    return (
        <div className="glass-panel" style={{ position: "relative", height: "100%", overflow: "auto" }}>
            <button onClick={onClose} style={{
                position: "absolute", top: 12, right: 14, background: "none", border: "none",
                color: "var(--text-muted)", cursor: "pointer", display: "flex",
            }}><X size={16} /></button>

            {/* Header */}
            <div style={{ marginBottom: "16px", paddingRight: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--text-primary)" }}>
                        {data.ticker}
                    </span>
                    {data.name && (
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{data.name}</span>
                    )}
                    {data.sector && <Badge variant="muted">{data.sector}</Badge>}
                    {data.current_price && (
                        <Badge variant="blue">${Number(data.current_price).toFixed(2)}</Badge>
                    )}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>KPI Dashboard</div>
            </div>

            {/* KPI grid */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "8px",
            }}>
                {Object.entries(data.kpis ?? {}).map(([label, value]) => (
                    <KpiCard key={label} label={label} value={value as string} />
                ))}
            </div>
        </div>
    );
}
