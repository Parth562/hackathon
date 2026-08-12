"use client";

import React from "react";
import { ChevronLeft, ChevronRight, AlignHorizontalDistributeCenter, Briefcase, LayoutDashboard } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "./ui/Button";

interface SessionSidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
}

export default function SessionSidebar({ collapsed, onToggleCollapse }: SessionSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();

    const navItem = (label: string, icon: React.ReactNode, path: string) => {
        const isActive = pathname === path;
        return collapsed ? (
            <button
                onClick={() => router.push(path)}
                title={label}
                style={{
                    width: "40px", height: "40px", borderRadius: "10px",
                    background: isActive ? "var(--bg-active)" : "transparent",
                    border: isActive ? "1px solid rgba(88,166,255,0.25)" : "none",
                    color: isActive ? "var(--primary)" : "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--primary)"; e.currentTarget.style.background = "var(--bg-hover)"; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; } }}
            >
                {icon}
            </button>
        ) : (
            <Button
                onClick={() => router.push(path)}
                variant={isActive ? "primary" : "ghost"}
                icon={icon as React.ReactElement}
                style={{ width: "100%", justifyContent: "flex-start" }}
            >
                {label}
            </Button>
        );
    };

    return (
        <aside style={{
            width: collapsed ? "56px" : "200px",
            minWidth: collapsed ? "56px" : "200px",
            height: "100%",
            background: "var(--bg-sidebar)",
            borderRight: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            transition: "width 0.25s cubic-bezier(0.16,1,0.3,1), min-width 0.25s cubic-bezier(0.16,1,0.3,1)",
            overflow: "hidden",
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

            {/* Navigation */}
            <div style={{ padding: collapsed ? "12px 8px" : "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {navItem("Canvas", <LayoutDashboard size={15} />, "/")}
                {navItem("Portfolio", <Briefcase size={15} />, "/portfolio")}
            </div>
        </aside>
    );
}
