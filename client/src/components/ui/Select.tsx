/**
 * ui/Select.tsx — styled native select primitive.
 */
"use client";
import React from "react";

interface SelectOption { value: string; label: string; }

interface SelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
    disabled?: boolean;
}

export function Select({ options, value, onChange, placeholder, style, disabled }: SelectProps) {
    return (
        <select
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            style={{
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                padding: "7px 32px 7px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                fontFamily: "var(--font-base)",
                cursor: disabled ? "not-allowed" : "pointer",
                outline: "none",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                ...style,
            }}
        >
            {placeholder && <option value="" disabled>{placeholder}</option>}
            {options.map((o) => (
                <option key={o.value} value={o.value} style={{ background: "var(--bg-elevated)" }}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}
