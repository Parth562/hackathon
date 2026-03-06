/**
 * ui/Input.tsx — text input, textarea, and file input primitives.
 */
"use client";
import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
    rightElement?: React.ReactNode;
    error?: string;
}

export function Input({ icon, rightElement, error, style, ...props }: InputProps) {
    return (
        <div style={{ position: "relative", width: "100%" }}>
            {icon && (
                <span style={{
                    position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
                    color: "var(--text-muted)", display: "flex", pointerEvents: "none",
                }}>
                    {icon}
                </span>
            )}
            <input
                className="input"
                {...props}
                style={{
                    paddingLeft: icon ? "38px" : undefined,
                    paddingRight: rightElement ? "40px" : undefined,
                    borderColor: error ? "var(--red)" : undefined,
                    ...style,
                }}
            />
            {rightElement && (
                <span style={{
                    position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                    display: "flex", alignItems: "center",
                }}>
                    {rightElement}
                </span>
            )}
            {error && (
                <p style={{ marginTop: "4px", fontSize: "0.75rem", color: "var(--red)" }}>{error}</p>
            )}
        </div>
    );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: string;
}

export function TextArea({ error, style, ...props }: TextAreaProps) {
    return (
        <div style={{ position: "relative", width: "100%" }}>
            <textarea
                className="input"
                {...props}
                style={{
                    resize: "none",
                    minHeight: "80px",
                    borderColor: error ? "var(--red)" : undefined,
                    ...style,
                }}
            />
            {error && (
                <p style={{ marginTop: "4px", fontSize: "0.75rem", color: "var(--red)" }}>{error}</p>
            )}
        </div>
    );
}
