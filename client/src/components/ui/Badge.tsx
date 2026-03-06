/**
 * ui/Badge.tsx — status badges and tags.
 */
"use client";
import React from "react";

type BadgeVariant = "blue" | "purple" | "green" | "red" | "amber" | "muted";

const variantMap: Record<BadgeVariant, { bg: string; color: string }> = {
    blue: { bg: "var(--primary-dim)", color: "var(--primary)" },
    purple: { bg: "var(--accent-dim)", color: "var(--accent)" },
    green: { bg: "var(--green-dim)", color: "var(--green)" },
    red: { bg: "var(--red-dim)", color: "var(--red)" },
    amber: { bg: "var(--amber-dim)", color: "var(--amber)" },
    muted: { bg: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" },
};

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    style?: React.CSSProperties;
}

export function Badge({ children, variant = "blue", style }: BadgeProps) {
    const { bg, color } = variantMap[variant];
    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 8px",
            borderRadius: "10px",
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            background: bg,
            color,
            ...style,
        }}>
            {children}
        </span>
    );
}

/** A coloured dot indicator */
export function StatusDot({ color = "var(--green)", pulse = false }: { color?: string; pulse?: boolean }) {
    return (
        <span style={{
            display: "inline-block",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
            animation: pulse ? "pulse-dot 1.2s ease-in-out infinite" : undefined,
        }} />
    );
}
