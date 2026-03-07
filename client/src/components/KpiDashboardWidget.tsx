"use client";
import React from "react";
import { X } from "lucide-react";
import { Badge } from "./ui/Badge";

interface Props { data: any; onClose: () => void; onOpenSettings?: () => void; }

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

export default function KpiDashboardWidget({ data, onClose, onOpenSettings }: Props) {
    if (data.error) return (
        <div className="glass-panel" style={{ borderLeft: "3px solid var(--red)" }}>
            <p style={{ color: "var(--red)" }}>{data.error}</p>
        </div>
    );

    return (
        <div className="glass-panel" style={{ position: "relative", height: "100%", overflow: "auto" }}>
            <div style={{ position: "absolute", top: 12, right: 14, display: "flex", gap: "8px", zIndex: 10 }}>
                {onOpenSettings && (
                    <button
                        onClick={onOpenSettings}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--primary)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                )}
                <button onClick={onClose} style={{
                    background: "none", border: "none",
                    color: "var(--text-muted)", cursor: "pointer", display: "flex",
                }}><X size={16} /></button>
            </div>

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
