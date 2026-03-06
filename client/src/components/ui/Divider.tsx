/**
 * ui/Divider.tsx — horizontal rule and section separator.
 */
"use client";
import React from "react";

interface DividerProps {
    label?: string;
    style?: React.CSSProperties;
}

export function Divider({ label, style }: DividerProps) {
    if (label) {
        return (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", ...style }}>
                <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                    {label}
                </span>
                <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
            </div>
        );
    }
    return <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", ...style }} />;
}

/** Empty state placeholder */
export function EmptyState({ icon, title, description }: { icon?: React.ReactNode; title: string; description?: string }) {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "40px 20px",
            color: "var(--text-muted)",
            textAlign: "center",
        }}>
            {icon && <div style={{ fontSize: "2rem", marginBottom: "4px", opacity: 0.5 }}>{icon}</div>}
            <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-secondary)" }}>{title}</p>
            {description && <p style={{ fontSize: "0.82rem" }}>{description}</p>}
        </div>
    );
}
