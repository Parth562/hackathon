"use client";
import React from "react";
import { X } from "lucide-react";

interface Props { data: any; onClose: () => void; onOpenSettings?: () => void; }

const SCENARIO_COLORS: Record<string, { border: string; bg: string; label: string }> = {
    Bear: { border: "rgba(248,81,73,0.4)", bg: "var(--red-dim)", label: "🐻 Bear" },
    Base: { border: "rgba(227,179,65,0.4)", bg: "var(--amber-dim)", label: "⚖️ Base" },
    Bull: { border: "rgba(63,185,80,0.4)", bg: "var(--green-dim)", label: "🐂 Bull" },
};

export default function ScenarioWidget({ data, onClose, onOpenSettings }: Props) {
    if (data.error) return (
        <div className="glass-panel" style={{ borderLeft: "3px solid var(--red)" }}>
            <p style={{ color: "var(--red)" }}>{data.error}</p>
        </div>
    );

    const currentPrice: number = data.current_price ?? 0;

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
                    color: "var(--text-muted)", cursor: "pointer",
                }}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: 14, paddingRight: 28 }}>
                <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{data.ticker}</span>
                {data.name && <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginLeft: 8 }}>{data.name}</span>}
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>Scenario Analysis (DCF)</div>
                {currentPrice > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 4 }}>
                        Current Price: <strong style={{ color: "var(--text-primary)" }}>${currentPrice.toFixed(2)}</strong>
                    </div>
                )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {Object.entries(data.scenarios ?? {}).map(([label, s]: [string, any]) => {
                    const cfg = SCENARIO_COLORS[label] ?? { border: "var(--border-default)", bg: "var(--bg-surface)", label };
                    const upColor = s.upside_pct >= 0 ? "var(--green)" : "var(--red)";
                    const impliedStr = s.implied_price != null ? `$${s.implied_price.toFixed(2)}` : "N/A";
                    const upsideStr = s.upside_pct != null ? `${s.upside_pct >= 0 ? "+" : ""}${s.upside_pct}%` : "N/A";

                    return (
                        <div key={label} style={{
                            background: cfg.bg, border: `1px solid ${cfg.border}`,
                            borderRadius: "var(--radius-md)", padding: "14px 12px",
                            display: "flex", flexDirection: "column", gap: 8,
                        }}>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{cfg.label}</div>

                            <div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Implied Price</div>
                                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>{impliedStr}</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: upColor }}>{upsideStr}</div>
                            </div>

                            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                                {[
                                    ["FCF Growth", s.growth_rate],
                                    ["Discount Rate", s.discount_rate],
                                    ["Terminal g", s.terminal_growth],
                                ].map(([k, v]) => (
                                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                                        <span style={{ color: "var(--text-muted)" }}>{k}</span>
                                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
