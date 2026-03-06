"use client";
import React from "react";
import { X } from "lucide-react";

interface Props { data: any; onClose: () => void; }

function RiskGauge({ score }: { score: number }) {
    const color = score < 35 ? "var(--green)" : score < 65 ? "var(--amber)" : "var(--red)";
    const label = score < 35 ? "Low Risk" : score < 65 ? "Medium Risk" : "High Risk";
    const angle = -135 + (score / 100) * 270; // sweep 270°

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {/* SVG gauge */}
            <svg width="160" height="100" viewBox="0 0 160 100">
                {/* Track */}
                <path d="M 20 90 A 60 60 0 0 1 140 90" fill="none" stroke="var(--bg-surface)" strokeWidth="12" strokeLinecap="round" />
                {/* Fill — approx using stroke-dasharray */}
                <path d="M 20 90 A 60 60 0 0 1 140 90" fill="none" stroke={color} strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 188} 188`} />
                {/* Needle */}
                <line
                    x1="80" y1="90"
                    x2={80 + 50 * Math.cos((angle - 90) * Math.PI / 180)}
                    y2={90 + 50 * Math.sin((angle - 90) * Math.PI / 180)}
                    stroke={color} strokeWidth="3" strokeLinecap="round"
                />
                <circle cx="80" cy="90" r="5" fill={color} />
                {/* Score */}
                <text x="80" y="76" textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="700">{score}</text>
                <text x="80" y="88" textAnchor="middle" fill={color} fontSize="9" fontWeight="600">{label}</text>
            </svg>
        </div>
    );
}

export default function RiskScoreWidget({ data, onClose }: Props) {
    if (data.error) return (
        <div className="glass-panel" style={{ borderLeft: "3px solid var(--red)" }}>
            <p style={{ color: "var(--red)" }}>{data.error}</p>
        </div>
    );

    const score: number = data.risk_score ?? 50;

    return (
        <div className="glass-panel" style={{ position: "relative", height: "100%", overflow: "auto" }}>
            <button onClick={onClose} style={{
                position: "absolute", top: 12, right: 14, background: "none", border: "none",
                color: "var(--text-muted)", cursor: "pointer",
            }}><X size={16} /></button>

            <div style={{ marginBottom: 10, paddingRight: 28 }}>
                <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{data.ticker}</span>
                {data.name && <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginLeft: 8 }}>{data.name}</span>}
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>Risk Profile</div>
            </div>

            <RiskGauge score={score} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
                {Object.entries(data.metrics ?? {}).map(([label, value]) => (
                    <div key={label} style={{
                        background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)", padding: "10px 12px",
                    }}>
                        <div style={{
                            fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600,
                            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4
                        }}>{label}</div>
                        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{value as string}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
