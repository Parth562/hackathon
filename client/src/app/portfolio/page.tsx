"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    RefreshCw, Check, X, TrendingUp, AlertTriangle, Briefcase, FileText,
    ExternalLink, Send, Loader2, Bot, User, LayoutDashboard, ChevronLeft, ChevronRight,
    AlignHorizontalDistributeCenter
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/Button";
import {
    fetchPortfolio, fetchPortfolioSuggestions, approveSuggestion,
    declineSuggestion, triggerPortfolioOptimization, streamChat, getCanvasSnapshot
} from "@/lib/api";

type PortfolioItem = { ticker: string; shares: number; cost_basis: number };
type Suggestion = {
    id: string; ticker: string; action: string; shares: number; reasoning: string; status: string;
    detailed_analysis?: string; citations?: string;
};
type ChatMessage = { id: string; role: "user" | "agent"; content: string; status?: "processing" | "completed" };

const MAIN_SESSION_KEY = "alexMainSessionId";

// ── Portfolio AI Chat Panel ───────────────────────────────────────────────────
function PortfolioChatPanel({ portfolio, sessionId }: { portfolio: PortfolioItem[]; sessionId: string | null }) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text || isStreaming || !sessionId) return;
        setInput("");

        const userMsg: ChatMessage = { id: Date.now() + "-u", role: "user", content: text, status: "completed" };
        const agentMsg: ChatMessage = { id: Date.now() + "-a", role: "agent", content: "", status: "processing" };
        setMessages((prev) => [...prev, userMsg, agentMsg]);
        setIsStreaming(true);

        // Prepend portfolio + canvas context to the message
        const snapshot = sessionId ? await getCanvasSnapshot(sessionId).catch(() => ({ nodes: [], edges: [] })) : { nodes: [], edges: [] };
        const portfolioSummary = portfolio.length > 0
            ? portfolio.map(p => `${p.ticker} (${p.shares} shares, cost basis $${p.cost_basis?.toFixed(2) ?? 0})`).join(", ")
            : "Empty portfolio";
        const canvasSummary = snapshot.nodes.length > 0
            ? snapshot.nodes.map((n: any) => {
                const wt = n.data?.widgetData?.widget_type || n.data?.widgetData?.type || n.type;
                const ticker = n.data?.widgetData?.ticker || n.data?.variableName;
                return ticker ? `${wt}(${ticker})` : wt;
            }).filter(Boolean).join(", ")
            : "No widgets on canvas";

        const contextPrefix = `[PORTFOLIO ADVISOR CONTEXT]\nHoldings: ${portfolioSummary}\nCanvas widgets: ${canvasSummary}\n\nUser question: `;
        const fullMessage = contextPrefix + text;

        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
            const res = await streamChat({
                message: fullMessage,
                session_id: sessionId ?? undefined,
                model_name: "gemini-2.5-flash",
                provider: "google",
            }, ctrl.signal);

            if (!res.body) throw new Error("No response body");
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let accumulated = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = dec.decode(value, { stream: true });
                for (const line of chunk.split("\n")) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const ev = JSON.parse(trimmed);
                        if (ev.type === "token") {
                            accumulated += ev.content;
                            setMessages((prev) => prev.map((m) =>
                                m.id === agentMsg.id ? { ...m, content: accumulated } : m
                            ));
                        } else if (ev.type === "result") {
                            accumulated = ev.response || accumulated;
                            setMessages((prev) => prev.map((m) =>
                                m.id === agentMsg.id ? { ...m, content: accumulated, status: "completed" } : m
                            ));
                        }
                    } catch { /* skip malformed */ }
                }
            }
            setMessages((prev) => prev.map((m) =>
                m.id === agentMsg.id ? { ...m, status: "completed" } : m
            ));
        } catch (e: any) {
            if (e?.name !== "AbortError") {
                setMessages((prev) => prev.map((m) =>
                    m.id === agentMsg.id ? { ...m, content: "Error: could not reach agent.", status: "completed" } : m
                ));
            }
        } finally {
            setIsStreaming(false);
            abortRef.current = null;
        }
    }, [input, isStreaming, sessionId, portfolio]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const suggestions = [
        "Analyze my portfolio risk and suggest hedging strategies",
        "Suggest a better calculation approach for my holdings",
        "What's the optimal position sizing for my portfolio?",
        "Add a Monte Carlo simulation widget for my top holding",
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-sidebar)" }}>
            {/* Header */}
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--primary-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={18} color="var(--primary)" />
                </div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>Portfolio Advisor</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Strategy · Risk · Calculation methods</div>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {messages.length === 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "8px" }}>Ask me about your portfolio strategy, risk management, or calculation methodologies:</p>
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => { setInput(s); }}
                                style={{
                                    textAlign: "left", padding: "10px 12px", borderRadius: "8px",
                                    background: "var(--bg-active)", border: "1px solid var(--border-subtle)",
                                    color: "var(--text-secondary)", fontSize: "0.8rem", cursor: "pointer",
                                    transition: "all 0.15s", lineHeight: 1.4,
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} style={{
                        display: "flex", gap: "8px", alignItems: "flex-start",
                        flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    }}>
                        <div style={{
                            width: "28px", height: "28px", borderRadius: "6px", flexShrink: 0,
                            background: msg.role === "user" ? "var(--primary)" : "var(--bg-active)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            {msg.role === "user"
                                ? <User size={14} color="#fff" />
                                : msg.status === "processing"
                                    ? <Loader2 size={14} color="var(--primary)" className="animate-spin" />
                                    : <Bot size={14} color="var(--primary)" />
                            }
                        </div>
                        <div style={{
                            maxWidth: "85%",
                            padding: "10px 12px",
                            borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                            background: msg.role === "user" ? "var(--primary)" : "var(--bg-active)",
                            border: msg.role === "agent" ? "1px solid var(--border-subtle)" : "none",
                            fontSize: "0.82rem",
                            lineHeight: 1.6,
                            color: msg.role === "user" ? "#fff" : "var(--text-secondary)",
                        }}>
                            {msg.role === "agent" && msg.content
                                ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                                : msg.content || <span style={{ opacity: 0.5 }}>Thinking...</span>
                            }
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: "8px", alignItems: "flex-end" }}>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={sessionId ? "Ask about strategy, risk, calculations..." : "Loading session..."}
                    disabled={!sessionId || isStreaming}
                    rows={2}
                    style={{
                        flex: 1, resize: "none", background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                        borderRadius: "8px", padding: "8px 10px", color: "var(--text-primary)", fontSize: "0.82rem",
                        outline: "none", fontFamily: "inherit", lineHeight: 1.5,
                    }}
                />
                <button
                    onClick={isStreaming ? () => { abortRef.current?.abort(); setIsStreaming(false); } : sendMessage}
                    disabled={!sessionId || (!isStreaming && !input.trim())}
                    style={{
                        width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
                        background: isStreaming ? "var(--red)" : "var(--primary)",
                        border: "none", color: "#fff", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: (!sessionId || (!isStreaming && !input.trim())) ? 0.4 : 1,
                        transition: "all 0.2s",
                    }}
                >
                    {isStreaming ? <X size={16} /> : <Send size={16} />}
                </button>
            </div>
        </div>
    );
}

// ── Portfolio Page ───────────────────────────────────────────────────────────
export default function PortfolioPage() {
    const router = useRouter();
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTriggering, setIsTriggering] = useState(false);
    const [selectedAnalysis, setSelectedAnalysis] = useState<Suggestion | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [chatCollapsed, setChatCollapsed] = useState(false);

    useEffect(() => {
        const id = localStorage.getItem(MAIN_SESSION_KEY);
        setSessionId(id);
    }, []);

    const loadData = useCallback(async () => {
        try {
            const [pData, sData] = await Promise.all([fetchPortfolio(), fetchPortfolioSuggestions()]);
            setPortfolio(pData || []);
            setSuggestions(sData || []);
        } catch (error) {
            console.error("Failed to load portfolio data", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, [loadData]);

    const handleApprove = async (id: string) => {
        try { await approveSuggestion(id); setSuggestions((prev) => prev.filter(s => s.id !== id)); loadData(); }
        catch (e) { console.error(e); }
    };

    const handleDecline = async (id: string) => {
        try { await declineSuggestion(id); setSuggestions((prev) => prev.filter(s => s.id !== id)); }
        catch (e) { console.error(e); }
    };

    const handleTriggerOptimization = async () => {
        setIsTriggering(true);
        try { await triggerPortfolioOptimization(); }
        catch (e) { console.error(e); }
        finally { setTimeout(() => setIsTriggering(false), 2000); }
    };

    return (
        <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)", overflow: "hidden" }}>

            {/* ── Left Sidebar: Optimization Suggestions ── */}
            <div style={{
                width: sidebarCollapsed ? "56px" : "320px",
                minWidth: sidebarCollapsed ? "56px" : "320px",
                borderRight: "1px solid var(--border-subtle)",
                background: "var(--bg-sidebar)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transition: "width 0.25s cubic-bezier(0.16,1,0.3,1), min-width 0.25s cubic-bezier(0.16,1,0.3,1)",
            }}>
                {/* Sidebar Header */}
                <div style={{ padding: sidebarCollapsed ? "16px 12px" : "16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <AlignHorizontalDistributeCenter size={18} color="#fff" />
                    </div>
                    {!sidebarCollapsed && (
                        <div>
                            <div style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.03em", color: "var(--text-primary)" }}>Alex</div>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Portfolio Optimizer</div>
                        </div>
                    )}
                    <button onClick={() => setSidebarCollapsed(c => !c)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex", alignItems: "center", flexShrink: 0 }}>
                        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                {/* Navigation */}
                {!sidebarCollapsed && (
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: "6px" }}>
                        <Button onClick={() => router.push("/")} variant="ghost" icon={<LayoutDashboard size={14} />} style={{ flex: 1, justifyContent: "center", fontSize: "0.8rem" }}>
                            Canvas
                        </Button>
                        <Button onClick={handleTriggerOptimization} disabled={isTriggering} icon={isTriggering ? <RefreshCw size={14} className="animate-spin" /> : <TrendingUp size={14} />} style={{ flex: 1, justifyContent: "center", fontSize: "0.8rem" }}>
                            {isTriggering ? "Scanning..." : "Optimize"}
                        </Button>
                    </div>
                )}

                {/* Collapsed nav icons */}
                {sidebarCollapsed && (
                    <div style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                        <button onClick={() => router.push("/")} title="Canvas" style={{ width: "40px", height: "40px", borderRadius: "10px", background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <LayoutDashboard size={18} />
                        </button>
                        <button onClick={handleTriggerOptimization} title="Optimize" style={{ width: "40px", height: "40px", borderRadius: "10px", background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <TrendingUp size={18} />
                        </button>
                    </div>
                )}

                {/* Suggestions list */}
                {!sidebarCollapsed && (
                    <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        {suggestions.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                                <AlertTriangle size={28} style={{ marginBottom: "10px", opacity: 0.4, display: "block", margin: "0 auto 10px" }} />
                                <p style={{ fontSize: "0.82rem" }}>No pending suggestions</p>
                            </div>
                        ) : (
                            suggestions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedAnalysis(s)}
                                    style={{
                                        padding: "14px", borderRadius: "var(--radius-md)", background: "var(--bg-active)",
                                        border: `1px solid ${s.action === 'buy' ? 'rgba(46,160,67,0.3)' : 'rgba(248,81,73,0.3)'}`,
                                        cursor: "pointer", transition: "all 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: s.action === 'buy' ? "var(--green)" : "var(--red)" }}>
                                            {s.action} {s.shares} SHARES
                                        </span>
                                        <strong style={{ color: "var(--text-primary)", fontSize: "0.9rem" }}>{s.ticker}</strong>
                                    </div>
                                    <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "12px" }}>{s.reasoning}</p>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                        <Button onClick={(e) => { e.stopPropagation(); handleApprove(s.id); }} style={{ flex: 1, justifyContent: "center", background: "var(--green)", fontSize: "0.78rem" }} variant="primary" icon={<Check size={12} />}>Approve</Button>
                                        <Button onClick={(e) => { e.stopPropagation(); handleDecline(s.id); }} style={{ flex: 1, justifyContent: "center", fontSize: "0.78rem" }} variant="ghost" icon={<X size={12} />}>Decline</Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* ── Main Area: Portfolio Holdings ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
                <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
                        <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--primary-dim)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                            <Briefcase size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>My Portfolio</h1>
                            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Active holdings · Use the advisor to optimize strategy</span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading...</div>
                    ) : portfolio.length === 0 ? (
                        <div style={{ padding: "60px 20px", textAlign: "center", border: "1px dashed var(--border-subtle)", borderRadius: "var(--radius-lg)" }}>
                            <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>Your portfolio is currently empty.</p>
                            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "8px" }}>Approve AI suggestions or ask the advisor to add holdings.</p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
                            {portfolio.map(item => (
                                <div key={item.ticker} style={{ padding: "20px", background: "var(--bg-sidebar)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                                    <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 14px 0", color: "var(--text-primary)" }}>{item.ticker}</h3>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                                        <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Shares</span>
                                        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.shares}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Cost Basis</span>
                                        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>${item.cost_basis?.toFixed(2) ?? "0.00"}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Right Panel: Portfolio Advisor Chat ── */}
            <div style={{
                width: chatCollapsed ? "48px" : "360px",
                minWidth: chatCollapsed ? "48px" : "360px",
                borderLeft: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transition: "width 0.25s cubic-bezier(0.16,1,0.3,1), min-width 0.25s cubic-bezier(0.16,1,0.3,1)",
                position: "relative",
            }}>
                {/* Collapse toggle */}
                <button
                    onClick={() => setChatCollapsed(c => !c)}
                    title={chatCollapsed ? "Open Advisor" : "Collapse Advisor"}
                    style={{
                        position: "absolute", top: "16px", left: chatCollapsed ? "8px" : "-1px",
                        zIndex: 10, width: "32px", height: "32px", borderRadius: chatCollapsed ? "8px" : "0 8px 8px 0",
                        background: "var(--bg-active)", border: "1px solid var(--border-subtle)",
                        borderLeft: chatCollapsed ? undefined : "none",
                        color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                >
                    {chatCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>

                {!chatCollapsed && <PortfolioChatPanel portfolio={portfolio} sessionId={sessionId} />}
            </div>

            {/* ── Full-Screen Analysis Modal ── */}
            {selectedAnalysis && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }} onClick={() => setSelectedAnalysis(null)}>
                    <div style={{ background: "var(--bg-base)", width: "100%", maxWidth: "900px", maxHeight: "90vh", borderRadius: "16px", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px rgba(0,0,0,0.5)", border: "1px solid var(--border-subtle)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-sidebar)" }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", color: "var(--text-primary)" }}>
                                    <FileText size={22} color="var(--primary)" /> AI Optimization Analysis
                                </h2>
                                <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                                    Recommendation: <span style={{ color: selectedAnalysis.action === 'buy' ? 'var(--green)' : 'var(--red)', fontWeight: 600, textTransform: "uppercase" }}>{selectedAnalysis.action} {selectedAnalysis.shares} shares of {selectedAnalysis.ticker}</span>
                                </p>
                            </div>
                            <button onClick={() => setSelectedAnalysis(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "8px" }}><X size={22} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: "32px", fontSize: "1rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                            {selectedAnalysis.detailed_analysis
                                ? <div className="prose prose-invert max-w-none"><ReactMarkdown>{selectedAnalysis.detailed_analysis}</ReactMarkdown></div>
                                : <p>{selectedAnalysis.reasoning}</p>
                            }
                            {selectedAnalysis.citations && selectedAnalysis.citations !== "[]" && (
                                <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid var(--border-subtle)" }}>
                                    <h3 style={{ fontSize: "1rem", color: "var(--text-primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <ExternalLink size={16} /> Sources
                                    </h3>
                                    <ul style={{ paddingLeft: "20px", margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                                        {(() => {
                                            try {
                                                const parsed = JSON.parse(selectedAnalysis.citations!);
                                                if (Array.isArray(parsed)) return parsed.map((cite, i) => <li key={i} style={{ color: "var(--primary)", fontSize: "0.88rem" }}>{cite}</li>);
                                            } catch { return <li>{selectedAnalysis.citations}</li>; }
                                        })()}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div style={{ padding: "20px 32px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-sidebar)", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <Button onClick={() => { handleDecline(selectedAnalysis.id); setSelectedAnalysis(null); }} variant="ghost" icon={<X size={14} />}>Decline</Button>
                            <Button onClick={() => { handleApprove(selectedAnalysis.id); setSelectedAnalysis(null); }} style={{ background: "var(--green)", color: "#fff" }} icon={<Check size={14} />}>Approve Transaction</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
