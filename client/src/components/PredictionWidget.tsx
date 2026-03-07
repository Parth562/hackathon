"use client";
import React from "react";
import { X, AlertTriangle } from "lucide-react";
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Badge } from "./ui/Badge";

interface Props { data: any; onClose: () => void; onOpenSettings?: () => void; }

export default function PredictionWidget({ data, onClose, onOpenSettings }: Props) {
    if (data.error) return (
        <div className="glass-panel" style={{ borderLeft: "3px solid var(--red)" }}>
            <p style={{ color: "var(--red)" }}>{data.error}</p>
        </div>
    );

    // Merge historical + forecast for a single chart
    const historical = (data.historical ?? []).map((p: any) => ({
        date: p.date,
        close: p.close,
        predicted: null,
        upper: null,
        lower: null,
    }));

    const forecast = (data.forecast ?? []).map((p: any) => ({
        date: p.date,
        close: null,
        predicted: p.predicted,
        upper: p.upper,
        lower: p.lower,
    }));

    const chartData = [...historical, ...forecast];
    const lastActual = historical.at(-1);
    const divider = lastActual?.date;

    const signalColor = (data.signal ?? "").includes("BULLISH") ? "var(--green)" : "var(--red)";

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

            <div style={{ marginBottom: 12, paddingRight: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{data.ticker}</span>
                    {data.name && <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{data.name}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.78rem", color: signalColor, fontWeight: 700 }}>{data.signal}</span>
                    {data.sma50 && <Badge variant="muted">SMA50  ${data.sma50}</Badge>}
                    {data.sma200 && <Badge variant="muted">SMA200 ${data.sma200}</Badge>}
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                        tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                    <YAxis stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                        domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                        contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "var(--text-secondary)" }}
                        itemStyle={{ color: "var(--text-primary)" }}
                        formatter={(v: any) => v != null ? `$${Number(v).toFixed(2)}` : null}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

                    {divider && <ReferenceLine x={divider} stroke="var(--border-strong)" strokeDasharray="4 4" label={{ value: "Forecast \u2192", fill: "var(--text-muted)", fontSize: 10, position: "insideTopRight" }} />}

                    {/* Confidence band */}
                    <Area dataKey="upper" stroke="none" fill="rgba(188, 179, 164, 0.15)" name="Upper band" legendType="none" connectNulls />
                    <Area dataKey="lower" stroke="none" fill="var(--bg-base)" name="Lower band" legendType="none" connectNulls />

                    {/* Lines */}
                    <Line dataKey="close" stroke="var(--primary)" strokeWidth={2} dot={false} name="Close Price" connectNulls />
                    <Line dataKey="predicted" stroke="var(--accent)" strokeWidth={2} dot={false} name="Forecast" strokeDasharray="5 4" connectNulls />
                </ComposedChart>
            </ResponsiveContainer>

            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 8, display: "flex", alignItems: "center", gap: "4px" }}>
                <AlertTriangle size={12} /> Forecast is a simplified linear regression model (not investment advice).
            </div>
        </div>
    );
}
