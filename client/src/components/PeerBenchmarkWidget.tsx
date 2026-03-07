"use client";
import React, { useState } from "react";
import { X, ArrowUpDown } from "lucide-react";
import { Badge } from "./ui/Badge";

interface Props { data: any; onClose: () => void; onOpenSettings?: () => void; }

export default function PeerBenchmarkWidget({ data, onClose, onOpenSettings }: Props) {
    const [sortMetric, setSortMetric] = useState<string | null>(null);

    if (data.error) return (
        <div className="glass-panel" style={{ borderLeft: "3px solid var(--red)" }}>
            <p style={{ color: "var(--red)" }}>{data.error}</p>
        </div>
    );

    const cols: string[] = data.columns ?? [];
    const rows: Record<string, Record<string, string>> = data.rows ?? {};
    const metrics = Object.keys(rows);

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

            <div style={{ marginBottom: "14px", paddingRight: "28px" }}>
                <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                    Peer Benchmark
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {data.primary} vs {(data.peers ?? []).join(", ")}
                </div>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr>
                            <th style={{
                                textAlign: "left", padding: "8px 10px", color: "var(--text-muted)",
                                fontWeight: 600, borderBottom: "1px solid var(--border-default)", position: "sticky", top: 0, background: "var(--bg-elevated)"
                            }}>
                                Metric
                            </th>
                            {cols.map((col) => (
                                <th key={col} style={{
                                    textAlign: "right", padding: "8px 10px",
                                    color: col === data.primary ? "var(--primary)" : "var(--text-secondary)",
                                    fontWeight: col === data.primary ? 800 : 600,
                                    borderBottom: "1px solid var(--border-default)",
                                    position: "sticky", top: 0, background: "var(--bg-elevated)",
                                }}>
                                    {col}
                                    {col === data.primary && <Badge variant="blue" style={{ marginLeft: 4 }}>Primary</Badge>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.map((metric, mi) => {
                            const rowData = rows[metric];
                            // Find best value for highlighting
                            const numVals = cols.map(c => parseFloat(String(rowData[c]).replace(/[^0-9.-]/g, ""))).filter(v => !isNaN(v));
                            const best = numVals.length ? Math.max(...numVals) : null;

                            return (
                                <tr key={metric} style={{ background: mi % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                                    <td style={{
                                        padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 500,
                                        borderBottom: "1px solid var(--border-subtle)"
                                    }}>
                                        {metric}
                                    </td>
                                    {cols.map((col) => {
                                        const raw = rowData[col];
                                        const num = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
                                        const isBest = !isNaN(num) && best !== null && Math.abs(num - best) < 0.01;
                                        return (
                                            <td key={col} style={{
                                                padding: "8px 10px", textAlign: "right",
                                                fontWeight: isBest ? 700 : 400,
                                                color: isBest ? "var(--green)" : col === data.primary ? "var(--text-primary)" : "var(--text-secondary)",
                                                borderBottom: "1px solid var(--border-subtle)",
                                            }}>
                                                {raw}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p style={{ marginTop: 8, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                ✦ Green = best in class for that metric
            </p>
        </div>
    );
}
