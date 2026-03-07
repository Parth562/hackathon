"use client";

import React from "react";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import { BarChart2 } from "lucide-react";

interface TableWidgetProps {
    data: {
        type: "table";
        title?: string;
        markdown: string; // the raw markdown table string
    };
    onClose?: (e?: React.MouseEvent) => void;
    onOutputChange?: (updates: Record<string, any>) => void;
    onOpenSettings?: () => void;
}

export default function TableWidget({ data, onClose, onOutputChange, onOpenSettings }: TableWidgetProps) {
    const title = data.title || "Data Table";

    const lastEmittedRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (onOutputChange && data.markdown && data.markdown !== lastEmittedRef.current) {
            lastEmittedRef.current = data.markdown;
            onOutputChange({ 'data': data.markdown });
        }
    }, [data.markdown, onOutputChange]);
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
                    <BarChart2 size={18} />
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
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
