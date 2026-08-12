"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Paperclip, StopCircle, Layers, Library, MessageSquare, Search, X, ChevronDown, ChevronUp, Check, XCircle, AlertTriangle, Wrench, Brain, MessageCircle, FileText, Compass, BarChart2, Edit3, Map as MapIcon, TrendingUp, Sigma, Microscope, Loader2, Sparkles, Zap } from "lucide-react";
import { Button, Spinner } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge, StatusDot } from "./ui/Badge";
import { ModeToggle, type ResearchMode } from "./ui/ModeToggle";
import { Select } from "./ui/Select";
import { Divider, EmptyState } from "./ui/Divider";
import { fetchModels, fetchDocuments, uploadDocument, deleteDocument, searchDocuments, streamChat } from "@/lib/api";
import { StreamEventSchema, type Model } from "@/lib/schemas";

const STATUS_ICONS: Record<string, React.ElementType> = {
    "Understanding your request...": Compass,
    "Fetching data...": BarChart2,
    "Updating portfolio...": Edit3,
    "Planner: Formulating research plan...": MapIcon,
    "Research Agent: Scouring the web and documents...": Search,
    "Data Agent: Retrieving hard financial figures...": TrendingUp,
    "Analysis Agent: Running quantitative models...": Sigma,
    "Critic Agent: Verifying reasoning and assessing risks...": Microscope,
    "Report Agent: Synthesizing final insight...": FileText
};

// ── Types ─────────────────────────────────────────────
interface Message {
    id: string;
    role: "user" | "agent";
    content: string;
    status?: "queued" | "processing" | "stopped" | "completed";
    thinking?: any[];
}

interface Props {
    onNewWidget: (data: any) => void;
    sessionId: string | null;
    onSessionCreated: (id: string) => void;
    restoredMessages?: { role: string; content: string }[] | null;
}

const PREF_MODEL_KEY = "ALEX_model_pref";
const PREF_MODE_KEY = "ALEX_mode_pref";


// ── Components ────────────────────────────────────────

const ThinkingLog = ({ events }: { events: any[] }) => {
    // Group reasoning tokens together
    const groupedEvents = React.useMemo(() => {
        const groups: any[] = [];
        for (const ev of events) {
            if (ev.kind === "reasoning") {
                const last = groups[groups.length - 1];
                if (last && last.kind === "reasoning") {
                    last.content += ev.content;
                } else {
                    groups.push({ ...ev });
                }
            } else {
                groups.push(ev);
            }
        }
        return groups;
    }, [events]);

    if (!events || events.length === 0) return null;

    // Custom markdown renderers for the inner log
    const markdownComponents = {
        p: ({ node, ...props }: any) => <p style={{ margin: "4px 0" }} {...props} />,
        a: ({ node, ...props }: any) => <a style={{ color: "var(--accent)", textDecoration: "none" }} target="_blank" {...props} />,
        strong: ({ node, ...props }: any) => <strong style={{ color: "var(--text-primary)" }} {...props} />,
        ul: ({ node, ...props }: any) => <ul style={{ margin: "4px 0", paddingLeft: "20px" }} {...props} />,
        li: ({ node, ...props }: any) => <li style={{ marginBottom: "2px" }} {...props} />,
        table: ({ node, ...props }: any) => (
            <div style={{ overflowX: "auto", margin: "8px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }} {...props} />
            </div>
        ),
        th: ({ node, ...props }: any) => <th style={{ padding: "4px 8px", borderBottom: "1px solid var(--border-subtle)", textAlign: "left", color: "var(--text-secondary)" }} {...props} />,
        td: ({ node, ...props }: any) => <td style={{ padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)" }} {...props} />,
        code: ({ node, inline, ...props }: any) => (
            <code style={{
                background: "rgba(0,0,0,0.3)",
                padding: inline ? "2px 4px" : "6px",
                borderRadius: "4px",
                fontSize: "0.7rem",
                display: inline ? "inline" : "block",
                overflowX: inline ? "visible" : "auto",
                whiteSpace: inline ? "normal" : "pre"
            }} {...props} />
        )
    };

    return (
        <div style={{
            marginTop: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            paddingTop: "12px",
            borderTop: "1px dashed var(--border-subtle)",
        }}>
            {groupedEvents.map((ev, i) => (
                <div key={i} style={{ fontSize: "0.85rem", lineHeight: 1.5, color: "var(--text-muted)" }}>
                    {ev.kind === "tool_start" && (
                        <div style={{
                            borderLeft: "2px solid var(--border-subtle)",
                            paddingLeft: "12px",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", color: "var(--text-secondary)" }}>
                                <Wrench size={12} />
                                <span style={{ fontSize: "0.75rem" }}>Using <strong>{ev.tool}</strong></span>
                            </div>
                            <pre style={{
                                fontSize: "0.7rem", margin: 0, color: "var(--text-muted)",
                                background: "rgba(0,0,0,0.2)", padding: "6px", borderRadius: "4px",
                                overflowX: "auto", fontFamily: "var(--font-base)", whiteSpace: "pre-wrap"
                            }}>
                                {JSON.stringify(ev.input)}
                            </pre>
                        </div>
                    )}
                    {ev.kind === "tool_end" && (
                        <div style={{
                            borderLeft: "2px solid var(--border-subtle)",
                            paddingLeft: "12px",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", color: "var(--text-secondary)" }}>
                                <Check size={12} />
                                <span style={{ fontSize: "0.75rem" }}>Result from <strong>{ev.tool}</strong></span>
                            </div>
                            <div className="prose-log" style={{
                                fontSize: "0.75rem", margin: 0, color: "var(--text-muted)",
                                background: "rgba(0,0,0,0.2)", padding: "8px 12px", borderRadius: "4px",
                                maxHeight: "300px", overflowY: "auto"
                            }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                    {ev.output}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
                    {ev.kind === "reasoning" && (
                        <div className="prose-log" style={{ paddingLeft: "2px" }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {ev.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};


// ── ChatInterface ─────────────────────────────────────
export default function ChatInterface({ onNewWidget, sessionId, onSessionCreated, restoredMessages }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [queue, setQueue] = useState<string[]>([]);
    const [statusMsg, setStatusMsg] = useState("Thinking...");
    // Rolling 2-line typewriter preview of LLM tokens shown in the status area
    const [tokenPreviewLines, setTokenPreviewLines] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<"chat" | "library">("chat");
    const [mode, setMode] = useState<ResearchMode>(() => {
        if (typeof window !== "undefined") return (localStorage.getItem(PREF_MODE_KEY) as ResearchMode) ?? "AUTO";
        return "AUTO";
    });
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModelId, setSelectedModelId] = useState<string>(() => {
        if (typeof window !== "undefined") return localStorage.getItem(PREF_MODEL_KEY) ?? "glm-5:cloud";
        return "glm-5:cloud";
    });
    const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [showControls, setShowControls] = useState(false);

    const abortRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Init ────────────────────────────────────────────
    useEffect(() => {
        fetchModels().then(setModels).catch(() => { });
        fetchDocuments().then(setUploadedDocs).catch(() => { });
    }, []);

    // Track prev sessionId so we can distinguish:
    //   null → newId  = session just created mid-stream → do NOT clear messages
    //   oldId → newId = explicit session switch         → DO clear messages
    //   anything → null = New Chat pressed              → DO clear messages
    const prevSessionIdRef = useRef<string | null>(null);
    useEffect(() => {
        const prev = prevSessionIdRef.current;
        const explicitSwitch = sessionId === null || (prev !== null && prev !== sessionId);
        if (explicitSwitch) setMessages([]);
        prevSessionIdRef.current = sessionId;
    }, [sessionId]);

    // Persist preferences
    useEffect(() => { localStorage.setItem(PREF_MODE_KEY, mode); }, [mode]);
    useEffect(() => { localStorage.setItem(PREF_MODEL_KEY, selectedModelId); }, [selectedModelId]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // Restore messages when a session is loaded from the sidebar
    useEffect(() => {
        if (!restoredMessages) return; // null = no restore needed (new chat or mid-stream)
        const converted = restoredMessages.map((m, i) => ({
            id: `restored-${i}`,
            role: m.role as "user" | "agent",
            content: m.content,
        }));
        setMessages(converted);
    }, [restoredMessages]);

    // Queue processor
    useEffect(() => {
        if (!loading && queue.length > 0) {
            const next = queue[0];
            setQueue((q) => q.slice(1));
            processQuery(next);
        }
    }, [queue, loading]);

    // ── Helpers ─────────────────────────────────────────
    const selectedModel = models.find((m) => m.id === selectedModelId);

    const currentProvider: string = selectedModel?.provider ?? "google";

    const addMessage = (msg: Omit<Message, "id">) =>
        setMessages((prev) => [...prev, { id: Date.now().toString() + Math.random(), ...msg }]);

    const updateLastAgent = (updater: (content: string) => string) =>
        setMessages((prev) => {
            const msgs = [...prev];
            const idx = msgs.map((m) => m.role).lastIndexOf("agent");
            if (idx >= 0) msgs[idx] = { ...msgs[idx], content: updater(msgs[idx].content) };
            return msgs;
        });

    // ── File upload ──────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            await uploadDocument(file);
            setUploadedDocs((prev) => prev.includes(file.name) ? prev : [...prev, file.name]);
            addMessage({ role: "agent", content: `**${file.name}** uploaded and indexed. Ask me anything about it!` });
        } catch {
            addMessage({ role: "agent", content: `Failed to upload **${file.name}**. Is the backend running?` });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDeleteDoc = async (name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        await deleteDocument(name).catch(() => { });
        setUploadedDocs((prev) => prev.filter((d) => d !== name));
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const results = await searchDocuments(searchQuery, 3);
            const formatted = results.map((r, i) =>
                `**Result ${i + 1}** — *${r.source}* (score: ${((r.score ?? 0) * 100).toFixed(0)}%)\n> "${r.text.substring(0, 220)}..."`
            ).join("\n\n");
            addMessage({ role: "user", content: `Search: "${searchQuery}"` });
            addMessage({ role: "agent", content: formatted || "No matches found in indexed documents." });
            setActiveTab("chat");
            setSearchQuery("");
        } finally { setSearching(false); }
    };

    // ── Chat ─────────────────────────────────────────────
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const text = input.trim();
        if (!text) return;
        setInput("");
        if (loading) {
            setQueue((q) => [...q, text]);
            addMessage({ role: "user", content: text, status: "queued" });
            return;
        }
        processQuery(text);
    };

    const handleStop = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setLoading(false);
        updateLastAgent((c) => c + "\n\n*[Stopped]*");
    };

    const processQuery = useCallback(async (query: string) => {
        setMessages((prev) => {
            if (prev.some((m) => m.content === query && m.status === "queued")) {
                return prev.map((m) => m.content === query && m.status === "queued"
                    ? { ...m, status: "processing" as const } : m);
            }
            return [...prev, { id: Date.now().toString(), role: "user", content: query, status: "processing" }];
        });
        setLoading(true);
        setStatusMsg("Initialising agent...");
        abortRef.current = new AbortController();

        try {
            const res = await streamChat({
                message: query,
                session_id: sessionId ?? undefined,
                model_name: selectedModelId,
                provider: currentProvider,
                forced_mode: mode === "AUTO" ? undefined : mode,
            }, abortRef.current.signal);

            if (!res.ok) throw new Error("Network error");

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let finalContent = "";
            let agentMsgId: string | null = null;  // id of the agent message bubble, null = not created yet
            let createdSessionId: string | null = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    let event: any;
                    try {
                        const raw = JSON.parse(line);
                        const parsed = StreamEventSchema.safeParse(raw);
                        event = parsed.success ? parsed.data : raw;
                    } catch { continue; }

                    if (event.type === "status") {
                        setStatusMsg(event.content);
                    } else if (event.type === "widget") {
                        // Intermediate widget received mid-stream! Instantly render it.
                        onNewWidget(event.content);
                    } else if (event.type === "token") {
                        finalContent += event.content;
                        const tokenContent = finalContent;

                        // -- Rolling 2-line preview in the status bar --
                        // Split accumulated content into trimmed non-empty lines,
                        // keep the last 2 for the status preview.
                        const allLines = tokenContent
                            .split("\n")
                            .map((l: string) => l.trim())
                            .filter((l: string) => l.length > 0);
                        const preview = allLines.slice(-2);
                        setTokenPreviewLines(preview);

                        if (!agentMsgId) {
                            const newId = Date.now().toString() + "agent";
                            agentMsgId = newId;
                            setMessages((prev) => [
                                ...prev,
                                { id: newId, role: "agent" as const, content: tokenContent },
                            ]);
                        } else {
                            const capturedId = agentMsgId;
                            setMessages((prev) =>
                                prev.map((m) => m.id === capturedId ? { ...m, content: tokenContent } : m)
                            );
                        }
                    } else if (event.type === "result") {
                        finalContent = event.response;
                        setTokenPreviewLines([]);
                        if (event.session_id) createdSessionId = event.session_id;
                        if (agentMsgId) {
                            const capturedId = agentMsgId;
                            setMessages((prev) =>
                                prev.map((m) => m.id === capturedId ? { ...m, content: finalContent } : m)
                            );
                        }
                    } else if (event.type === "thinking") {
                        if (!agentMsgId) {
                            const newId = Date.now().toString() + "agent";
                            agentMsgId = newId;
                            setMessages((prev) => [
                                ...prev,
                                { id: newId, role: "agent" as const, content: "", thinking: [event] },
                            ]);
                        } else {
                            const capturedId = agentMsgId;
                            setMessages((prev) =>
                                prev.map((m) => m.id === capturedId ? { ...m, thinking: [...(m.thinking || []), event] } : m)
                            );
                        }
                    } else if (event.type === "error") {
                        finalContent = "Error: " + event.content;
                        setTokenPreviewLines([]);
                    }
                }
            }

            // Parse widgets from final content
            const widgetRegex = /```widget\n([\s\S]*?)```/g;
            let match: RegExpExecArray | null;
            while ((match = widgetRegex.exec(finalContent)) !== null) {
                try { onNewWidget(JSON.parse(match[1])); } catch { /* skip malformed */ }
            }
            finalContent = finalContent.replace(widgetRegex, "*[Widget added to board →]*");

            // ── Smart top-2 table extraction → canvas ──────────────────────
            // 1. Collect all valid GFM tables (must have separator row with ---)
            interface ExtractedTable {
                fullMatch: string;
                block: string;
                title: string;
                cols: number;
                rows: number;
                score: number;
            }
            const allTables: ExtractedTable[] = [];
            const tableRegex2 = /(?:^|\n)((?:\|[^\n]+\|\n)+)/g;
            let tm: RegExpExecArray | null;
            while ((tm = tableRegex2.exec(finalContent)) !== null) {
                const fullMatch = tm[0];
                const block = tm[1];
                if (!block.includes("---")) continue;
                const lines = block.trim().split("\n");
                const headerCells = lines[0].split("|").map((c: string) => c.trim()).filter(Boolean);
                const title = headerCells.length > 0 ? `Table: ${headerCells.join(" · ")}` : `Data Table`;
                const cols = Math.max(headerCells.length, 2);
                const rows = Math.max(lines.length - 2, 1);

                // 2. Relevance score = keyword overlap between table content and user query
                const queryWords = new Set(
                    query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w: string) => w.length > 2)
                );
                const tableText = block.toLowerCase();
                let overlap = 0;
                queryWords.forEach((w: string) => { if (tableText.includes(w)) overlap++; });

                // Bonus: tables with more data rows are more informative
                const rowBonus = Math.min(rows * 0.5, 5);
                // Penalty for tables that are summary/overview (often less specific)
                const positionPenalty = allTables.length > 2 ? 1 : 0;
                const score = overlap + rowBonus - positionPenalty;

                allTables.push({ fullMatch, block: block.trim(), title, cols, rows, score });
            }

            // 3. Sort by relevance and take top 2
            const top2 = [...allTables].sort((a, b) => b.score - a.score).slice(0, 2);
            const top2Blocks = new Set(top2.map((t) => t.block));

            // 4. Replace matched tables — send top-2 to canvas, leave rest inline
            for (const { fullMatch, block, title, cols, rows } of allTables) {
                if (top2Blocks.has(block)) {
                    onNewWidget({ type: "table", title, markdown: block, _cols: cols, _rows: rows });
                    finalContent = finalContent.replace(
                        fullMatch,
                        `\n\n> **${title}** — *pinned to canvas*\n`
                    );
                }
                // Tables NOT in top-2 stay rendered in chat as regular markdown
            }


            // Final update of the agent bubble (use saved id, not fragile lastIndexOf)
            if (agentMsgId) {
                const capturedId = agentMsgId;
                setMessages((prev) =>
                    prev.map((m) => m.id === capturedId ? { ...m, content: finalContent } : m)
                );
            } else {
                // No tokens came through — push a fresh bubble
                setMessages((prev) => [
                    ...prev,
                    { id: Date.now().toString() + "b", role: "agent" as const, content: finalContent },
                ]);
            }

            // Fire session creation AFTER messages are fully settled
            if (createdSessionId) onSessionCreated(createdSessionId);
        } catch (e: any) {
            if (e.name !== "AbortError") {
                addMessage({ role: "agent", content: "Failed to connect to the backend. Is the FastAPI server running on port 8261?" });
            }
        } finally {
            setLoading(false);
            setTokenPreviewLines([]);
            abortRef.current = null;
        }
    }, [sessionId, selectedModelId, currentProvider, mode, onNewWidget, onSessionCreated]);

    // ── Render ───────────────────────────────────────────
    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

            {/* ── Header ────────────────────────────────────── */}
            <div style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
                gap: "10px",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MessageSquare size={18} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>Chat</span>
                    {sessionId && (
                        <Badge variant="muted">{mode === "AUTO" ? "Auto" : mode === "QUICK" ? "Quick" : mode === "CONTEXT" ? "Context" : "Deep"}</Badge>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        onClick={() => setActiveTab(activeTab === "library" ? "chat" : "library")}
                        title="Document Library"
                        style={{
                            background: activeTab === "library" ? "var(--primary-dim)" : "transparent",
                            border: "1px solid " + (activeTab === "library" ? "rgba(88,166,255,0.25)" : "var(--border-subtle)"),
                            color: activeTab === "library" ? "var(--primary)" : "var(--text-muted)",
                            cursor: "pointer",
                            padding: "6px 10px",
                            borderRadius: "var(--radius-sm)",
                            display: "flex", alignItems: "center", gap: "5px",
                            fontSize: "0.8rem",
                            transition: "all 0.2s ease",
                        }}
                    >
                        <Library size={14} />
                        {uploadedDocs.length > 0 && (
                            <span style={{
                                background: "var(--primary)", color: "#fff",
                                borderRadius: "8px", padding: "0px 5px", fontSize: "0.65rem", fontWeight: 700,
                            }}>{uploadedDocs.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setShowControls((c) => !c)}
                        title="Model & Mode settings"
                        style={{
                            background: showControls ? "var(--bg-elevated)" : "transparent",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "6px 8px",
                            borderRadius: "var(--radius-sm)",
                            display: "flex", alignItems: "center",
                            transition: "all 0.2s ease",
                        }}
                    >
                        {showControls ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* ── Controls drawer ────────────────────────────── */}
            {showControls && (
                <div style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    background: "var(--bg-elevated)",
                    flexShrink: 0,
                    animation: "fadeIn 0.2s ease",
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Research Mode</span>
                        <ModeToggle value={mode} onChange={setMode} />
                    </div>
                    {models.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Model</span>
                            <Select
                                value={selectedModelId}
                                onChange={setSelectedModelId}
                                options={models.map((m) => ({ value: m.id, label: m.name }))}
                                style={{ maxWidth: "200px" }}
                            />
                        </div>
                    )}
                    {mode === "DEEP" && (
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                            <Brain size={14} style={{ marginRight: "6px" }} /> <strong>Deep mode</strong> enables comprehensive analysis: DCF modelling, peer benchmarking, and thesis generation. Responses may take longer.
                        </p>
                    )}
                </div>
            )}

            {/* ── Document Library tab ──────────────────────── */}
            {activeTab === "library" && (
                <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                    {/* Upload */}
                    <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: "none" }} accept=".pdf,.txt" />
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            loading={uploading}
                            icon={<Paperclip size={14} />}
                            size="sm"
                            style={{ flex: 1 }}
                        >
                            {uploading ? "Uploading…" : "Upload Document"}
                        </Button>
                    </div>

                    {/* Search */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                        <Input
                            placeholder="Search documents…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            icon={<Search size={14} />}
                            style={{ flex: 1 }}
                        />
                        <Button size="sm" loading={searching} onClick={handleSearch} icon={<Search size={14} />}>
                            Search
                        </Button>
                    </div>

                    <Divider label="Indexed Documents" />

                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {uploadedDocs.length === 0 ? (
                            <EmptyState icon={<FileText size={24} />} title="No documents yet" description="Upload PDFs or TXTs to give the agent company-specific context." />
                        ) : uploadedDocs.map((doc) => (
                            <div key={doc} style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "8px 12px",
                                background: "var(--bg-elevated)",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border-subtle)",
                            }}>
                                <Paperclip size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc}</span>
                                <button onClick={() => handleDeleteDoc(doc)} title="Delete"
                                    style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", display: "flex", padding: "2px" }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Chat messages ─────────────────────────────── */}
            {activeTab === "chat" && (
                <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {messages.length === 0 && (
                        <EmptyState
                            icon={<MessageCircle size={24} />}
                            title="How can Alex help?"
                            description={'Ask me to analyse stocks, build a DCF model, or say "I bought 100 shares of AAPL".'}
                        />
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} style={{
                            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                            maxWidth: "92%",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                        }}>
                            {msg.status === "queued" && (
                                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", alignSelf: "flex-end" }}>queued</span>
                            )}
                            <div style={{
                                padding: msg.role === "user" ? "10px 14px" : "12px 16px",
                                borderRadius: msg.role === "user"
                                    ? "var(--radius-md) var(--radius-md) 4px var(--radius-md)"
                                    : "4px var(--radius-md) var(--radius-md) var(--radius-md)",
                                background: msg.role === "user"
                                    ? "var(--primary)"
                                    : "var(--bg-elevated)",
                                border: msg.role === "agent" ? "1px solid var(--border-subtle)" : "none",
                                color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                                fontSize: "0.875rem",
                                lineHeight: 1.65,
                                overflowWrap: "anywhere",
                                boxShadow: msg.role === "user"
                                    ? "0 2px 8px rgba(88,166,255,0.2)"
                                    : "var(--shadow-sm)",
                            }}>
                                {msg.role === "agent" ? (
                                    <>
                                        <div className="markdown-body">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    table: ({ children }) => (
                                                        <div className="md-table-wrap">
                                                            <table>{children}</table>
                                                        </div>
                                                    ),
                                                }}
                                            >{msg.content}</ReactMarkdown>
                                        </div>
                                        {msg.thinking && msg.thinking.length > 0 && (
                                            <ThinkingLog events={msg.thinking} />
                                        )}
                                    </>
                                ) : (
                                    <span>{msg.content}</span>
                                )}
                            </div>
                        </div>
                    ))}

                    {queue.length > 0 && (
                        <div style={{
                            alignSelf: "center", display: "flex", alignItems: "center", gap: "8px",
                            padding: "6px 14px", background: "var(--bg-elevated)", borderRadius: "20px",
                            border: "1px solid var(--border-subtle)", fontSize: "0.8rem", color: "var(--text-secondary)",
                        }}>
                            <Layers size={13} />
                            {queue.length} {queue.length === 1 ? "query" : "queries"} queued
                        </div>
                    )}

                    {loading && (
                        <div style={{
                            alignSelf: "flex-start",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            padding: "10px 14px",
                            background: "var(--bg-elevated)",
                            borderRadius: "4px var(--radius-md) var(--radius-md) var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                            boxShadow: "var(--shadow-sm)",
                            maxWidth: "88%",
                            minWidth: "200px",
                        }}>
                            {/* Stage label row */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {STATUS_ICONS[statusMsg] ? (
                                    React.createElement(STATUS_ICONS[statusMsg], { size: 14, color: "var(--primary)" })
                                ) : (
                                    <StatusDot color="var(--primary)" pulse />
                                )}
                                <span style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    color: "var(--text-muted)",
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                }}>
                                    {statusMsg}
                                </span>
                            </div>

                            {/* Rolling 2-line token preview */}
                            {tokenPreviewLines.length > 0 && (
                                <div style={{
                                    borderTop: "1px solid var(--border-subtle)",
                                    paddingTop: "6px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px",
                                    overflow: "hidden",
                                }}>
                                    {tokenPreviewLines.map((line, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                fontSize: "0.8rem",
                                                lineHeight: 1.55,
                                                color: i === tokenPreviewLines.length - 1
                                                    ? "var(--text-primary)"
                                                    : "var(--text-muted)",
                                                opacity: i === tokenPreviewLines.length - 1 ? 1 : 0.55,
                                                fontFamily: "var(--font-base)",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                maxWidth: "340px",
                                                animation: "fadeIn 0.1s ease",
                                            }}
                                        >
                                            {line}
                                        </div>
                                    ))}
                                    {/* blinking cursor on the last line */}
                                    <span style={{
                                        display: "inline-block",
                                        width: "7px",
                                        height: "13px",
                                        background: "var(--primary)",
                                        borderRadius: "1px",
                                        animation: "pulse-dot 0.9s ease-in-out infinite",
                                        verticalAlign: "middle",
                                        marginTop: "2px",
                                    }} />
                                </div>
                            )}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            )}

            {/* ── Input area ────────────────────────────────── */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
                <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: "none" }} accept=".pdf,.txt" />
                    {/* Compact mode cycling button */}
                    <button
                        type="button"
                        onClick={() => {
                            const modes: ResearchMode[] = ["AUTO", "QUICK", "CONTEXT", "DEEP"];
                            const idx = modes.indexOf(mode);
                            setMode(modes[(idx + 1) % modes.length]);
                        }}
                        title={`Mode: ${mode} — click to cycle`}
                        style={{
                            background: mode === "AUTO" ? "rgba(168,85,247,0.15)"
                                : mode === "DEEP" ? "rgba(239,68,68,0.15)"
                                    : mode === "CONTEXT" ? "rgba(88,166,255,0.15)"
                                        : "var(--bg-elevated)",
                            border: "1px solid " + (
                                mode === "AUTO" ? "rgba(168,85,247,0.3)"
                                    : mode === "DEEP" ? "rgba(239,68,68,0.3)"
                                        : mode === "CONTEXT" ? "rgba(88,166,255,0.3)"
                                            : "var(--border-subtle)"
                            ),
                            color: mode === "AUTO" ? "rgb(168,85,247)"
                                : mode === "DEEP" ? "rgb(239,68,68)"
                                    : mode === "CONTEXT" ? "var(--primary)"
                                        : "var(--text-muted)",
                            padding: "7px 10px",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            flexShrink: 0,
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            transition: "all 0.2s ease",
                            letterSpacing: "0.02em",
                        }}
                    >
                        {mode === "AUTO" ? <><Sparkles size={14} /> Auto</>
                            : mode === "QUICK" ? <><Zap size={14} /> Quick</>
                                : mode === "CONTEXT" ? <><Search size={14} /> Ctx</>
                                    : <><Brain size={14} /> Deep</>}
                    </button>

                    <input
                        className="input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={loading ? "Type to queue…" : "Ask about markets, stocks, portfolios…"}
                        style={{ flex: 1, borderRadius: "var(--radius-sm)", padding: "9px 14px" }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e as any);
                            }
                        }}
                    />

                    {loading ? (
                        <Button type="button" variant="danger" onClick={handleStop} icon={<StopCircle size={16} />} size="md" />
                    ) : (
                        <Button type="submit" disabled={!input.trim()} icon={<Send size={16} />} size="md" />
                    )}
                </form>
            </div>
        </div>
    );
}
