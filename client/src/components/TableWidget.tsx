"use client";

import React from "react";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";

interface TableWidgetProps {
    data: {
        type: "table";
        title?: string;
        markdown: string; // the raw markdown table string
    };
    onClose?: (e?: React.MouseEvent) => void;
}

export default function TableWidget({ data, onClose }: TableWidgetProps) {
    const title = data.title || "Data Table";
    return (
        <div
            className="glass-panel"
            style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
            }}
        >
            {/* Header */}
            <div
                className="drag-handle"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                    cursor: "grab",
                    flexShrink: 0,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.1rem" }}>📊</span>
                    <span
                        style={{
                            fontWeight: 700,
                            fontSize: "0.92rem",
                            color: "var(--text-primary)",
                        }}
                    >
                        {title}
                    </span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            fontSize: "16px",
                            lineHeight: 1,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.color = "var(--red)")
                        }
                        onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")
                        }
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Table content */}
            <div
                className="markdown-body"
                style={{
                    flex: 1,
                    overflow: "auto",
                    fontSize: "0.875rem",
                }}
            >
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        table: ({ children }) => (
                            <div className="md-table-wrap">
                                <table>{children}</table>
                            </div>
                        ),
                    }}
                >
                    {data.markdown}
                </ReactMarkdown>
            </div>
        </div>
    );
}
