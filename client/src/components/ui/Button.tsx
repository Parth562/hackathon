/**
 * ui/Button.tsx — primary primitive. All interactive buttons must use this.
 */
"use client";
import React from "react";

type Variant = "primary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
    primary: {
        background: "var(--primary)",
        color: "#fff",
        border: "none",
    },
    ghost: {
        background: "transparent",
        color: "var(--text-secondary)",
        border: "1px solid var(--border-subtle)",
    },
    danger: {
        background: "var(--red)",
        color: "#fff",
        border: "none",
    },
    success: {
        background: "var(--green)",
        color: "#fff",
        border: "none",
    },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
    sm: { padding: "5px 12px", fontSize: "0.8rem", borderRadius: "var(--radius-sm)", gap: "5px" },
    md: { padding: "8px 16px", fontSize: "0.875rem", borderRadius: "var(--radius-sm)", gap: "6px" },
    lg: { padding: "10px 20px", fontSize: "0.95rem", borderRadius: "var(--radius-md)", gap: "8px" },
};

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    iconRight,
    children,
    disabled,
    style,
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            disabled={disabled || loading}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-base)",
                fontWeight: 600,
                cursor: disabled || loading ? "not-allowed" : "pointer",
                transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                whiteSpace: "nowrap",
                opacity: disabled || loading ? 0.45 : 1,
                ...variantStyles[variant],
                ...sizeStyles[size],
                ...style,
            }}
        >
            {loading ? <Spinner size={14} /> : icon}
            {children}
            {iconRight}
        </button>
    );
}

// ── Spinner (tiny, reusable) ─────────────────────────
interface SpinnerProps { size?: number; color?: string; }
export function Spinner({ size = 16, color = "currentColor" }: SpinnerProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.5" strokeDasharray="56" strokeDashoffset="14" strokeLinecap="round" />
        </svg>
    );
}
