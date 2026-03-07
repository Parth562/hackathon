"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, TrendingUp, AlignHorizontalDistributeCenter } from "lucide-react";
import { Button } from "./ui/Button";
import { Divider, EmptyState } from "./ui/Divider";
import { type SessionMeta } from "@/lib/schemas";
import { fetchSessions, deleteSession } from "@/lib/api";

interface SessionSidebarProps {
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onNewChat: () => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
}

function groupByDate(sessions: SessionMeta[]): { label: string; items: SessionMeta[] }[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const lastWeek = new Date(today.getTime() - 7 * 86400000);

    const groups: Record<string, SessionMeta[]> = { Today: [], Yesterday: [], "This Week": [], Older: [] };

    for (const s of sessions) {
        const d = new Date(s.updated_at);
        if (d >= today) groups["Today"].push(s);
        else if (d >= yesterday) groups["Yesterday"].push(s);
        else if (d >= lastWeek) groups["This Week"].push(s);
        else groups["Older"].push(s);
    }

    return Object.entries(groups)
        .filter(([, items]) => items.length > 0)
        .map(([label, items]) => ({ label, items }));
}

export default function SessionSidebar({
    activeSessionId,
    onSelectSession,
    onNewChat,
    collapsed,
    onToggleCollapse,
}: SessionSidebarProps) {
    const [sessions, setSessions] = useState<SessionMeta[]>([]);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await fetchSessions();
            setSessions(data);
        } catch { /* ignore — backend might not be up yet */ }
    }, []);

    useEffect(() => { load(); }, [load, activeSessionId]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await deleteSession(id);
            setSessions((prev) => prev.filter((s) => s.id !== id));
            if (activeSessionId === id) onNewChat();
        } catch (err) { console.error(err); }
    };

    const groups = groupByDate(sessions);

    return (
        <aside style={{
            width: collapsed ? "56px" : "240px",
            minWidth: collapsed ? "56px" : "240px",
            height: "100%",
            background: "var(--bg-sidebar)",
            borderRight: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            transition: "width 0.25s cubic-bezier(0.16,1,0.3,1), min-width 0.25s cubic-bezier(0.16,1,0.3,1)",
            overflow: "hidden",
            position: "relative",
        }}>
            {/* Brand header */}
            <div style={{
                padding: collapsed ? "16px 12px" : "16px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexShrink: 0,
            }}>
                <div style={{
                    width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
                    background: "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <AlignHorizontalDistributeCenter size={18} color="#fff" />
                </div>
                {!collapsed && (
                    <div>
                        <div style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.03em", color: "var(--text-primary)" }}>Alex</div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Financial Asset Management</div>
                    </div>
                )}
                <button
                    onClick={onToggleCollapse}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    style={{
                        marginLeft: "auto",
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        transition: "color 0.15s, background 0.15s",
                        flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = "none"; }}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* New Chat button */}
            <div style={{ padding: collapsed ? "12px 8px" : "12px", flexShrink: 0 }}>
                {collapsed ? (
                    <button
                        onClick={onNewChat}
                        title="New Chat"
                        style={{
                            width: "40px", height: "40px", borderRadius: "10px",
                            background: "var(--primary-dim)",
                            border: "1px solid rgba(88,166,255,0.2)",
                            color: "var(--primary)",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s ease",
                        }}
                    >
                        <Plus size={18} />
                    </button>
                ) : (
                    <Button
                        onClick={onNewChat}
                        icon={<Plus size={15} />}
                        style={{ width: "100%", justifyContent: "center" }}
                    >
                        New Chat
                    </Button>
                )}
            </div>

            {/* Session list */}
            {!collapsed && (
                <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
                    {groups.length === 0 ? (
                        <EmptyState icon={<MessageSquare />} title="No sessions yet" description="Start a new chat to begin" />
                    ) : (
                        groups.map(({ label, items }) => (
                            <div key={label} style={{ marginBottom: "8px" }}>
                                <Divider label={label} style={{ margin: "8px 0 6px" }} />
                                {items.map((s) => {
                                    const isActive = s.id === activeSessionId;
                                    const isHovered = s.id === hoveredId;
                                    return (
                                        <div
                                            key={s.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => onSelectSession(s.id)}
                                            onKeyDown={(e) => e.key === "Enter" && onSelectSession(s.id)}
                                            onMouseEnter={() => setHoveredId(s.id)}
                                            onMouseLeave={() => setHoveredId(null)}
                                            style={{
                                                width: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                padding: "8px 10px",
                                                borderRadius: "var(--radius-sm)",
                                                border: "none",
                                                background: isActive ? "var(--bg-active)" : isHovered ? "var(--bg-hover)" : "transparent",
                                                color: isActive ? "var(--primary)" : "var(--text-secondary)",
                                                cursor: "pointer",
                                                textAlign: "left",
                                                transition: "all 0.15s ease",
                                                outline: isActive ? "1px solid rgba(88,166,255,0.25)" : "none",
                                                outlineOffset: "0px",
                                            }}
                                        >
                                            <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                                            <span style={{
                                                flex: 1,
                                                fontSize: "0.825rem",
                                                fontWeight: isActive ? 600 : 400,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}>
                                                {s.title || "Untitled Chat"}
                                            </span>
                                            {isHovered && (
                                                <button
                                                    onClick={(e) => handleDelete(e, s.id)}
                                                    title="Delete session"
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        color: "var(--red)",
                                                        cursor: "pointer",
                                                        padding: "2px",
                                                        display: "flex",
                                                        borderRadius: "4px",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            )}
        </aside>
    );
}
