"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Node, Edge } from "reactflow";
import SessionSidebar from "@/components/SessionSidebar";
import ChatInterface from "@/components/ChatInterface";
import { fetchSession, saveBoardState, pushCanvasState, pollCanvasActions } from "@/lib/api";

const DynamicBoard = dynamic(() => import("@/components/DynamicBoard"), { ssr: false });

export default function Home() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [widgets, setWidgets] = useState<any[]>([]); // Acts as an append-log for new widgets
  const [boardData, setBoardData] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [restoredMessages, setRestoredMessages] = useState<{ role: string; content: string }[] | null>(null);

  // Track if the activeSessionId was just created mid-stream (vs selected from sidebar).
  // If just created, we must NOT overwrite widgets with the empty saved board.
  const sessionFromCreationRef = useRef(false);

  const handleSessionCreated = useCallback((newId: string) => {
    sessionFromCreationRef.current = true;   // mark as "just created"
    setActiveSessionId(newId);
    setRestoredMessages(null); // newly created — no restore needed
  }, []);

  // Load board state + messages whenever session changes (skip if just created)
  useEffect(() => {
    if (!activeSessionId) { setWidgets([]); setBoardData(null); setRestoredMessages(null); return; }
    if (sessionFromCreationRef.current) {
      sessionFromCreationRef.current = false;
      return;
    }
    fetchSession(activeSessionId)
      .then((s) => {
        const board = s.board_state as any;
        if (board && !Array.isArray(board) && board.nodes) {
          setBoardData({ nodes: board.nodes, edges: board.edges || [] });
          setWidgets([]);
        } else {
          // Legacy migration
          const restored = (s.board_state ?? []).map((item: any, i: number) => ({
            id: item._widgetId ?? `restored-${Date.now()}-${i}`,
            data: item,
          }));
          setWidgets(restored);
          setBoardData(null);
        }
        setRestoredMessages(s.messages ?? []);
      })
      .catch(() => { setWidgets([]); setBoardData(null); setRestoredMessages([]); });
  }, [activeSessionId]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBoardChange = useCallback((nodes: Node[], edges: Edge[]) => {
    if (!activeSessionId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveBoardState(activeSessionId, { nodes, edges }).catch(() => { });

      const nodesSummary = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.type === 'variableNode'
          ? { variableName: n.data?.variableName, variableValue: n.data?.variableValue }
          : { widgetData: { type: n.data?.widgetData?.type, widget_type: n.data?.widgetData?.widget_type, ticker: n.data?.widgetData?.ticker, function: n.data?.widgetData?.function } },
      }));
      pushCanvasState(activeSessionId, nodesSummary, edges).catch(() => { });
    }, 2000);
  }, [activeSessionId]);

  const handleNewWidget = useCallback((widgetData: any) => {
    setWidgets((prev) => {
      const newId = Date.now().toString() + "-" + Math.floor(Math.random() * 1e6);
      return [{ id: newId, data: { ...widgetData, _widgetId: newId } }, ...prev];
    });
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  // ── LLM Canvas Action Polling ──────────────────────────
  // Expose a setter so DynamicBoard's edges can be updated from the outside
  const [pendingCanvasActions, setPendingCanvasActions] = useState<any[]>([]);

  useEffect(() => {
    if (!activeSessionId) return;
    const interval = setInterval(async () => {
      const actions = await pollCanvasActions(activeSessionId);
      if (actions.length > 0) setPendingCanvasActions((prev) => [...prev, ...actions]);
    }, 2500);
    return () => clearInterval(interval);
  }, [activeSessionId]);



  const handleNewChat = () => {
    setActiveSessionId(null);
    setWidgets([]);
    setRestoredMessages(null);
  };

  // ── Resizable Chat Panel ─────────────────────────
  const [chatWidth, setChatWidth] = useState(380);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>

      {/* ── Session Sidebar ──────────────────────────── */}
      <SessionSidebar
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewChat={handleNewChat}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      {/* ── Canvas / Board ─────────────────────────────────── */}
      <div style={{ flex: 1, height: "100%", overflow: "hidden", position: "relative" }}>
        <DynamicBoard
          key={activeSessionId ?? "no-session"}
          widgets={widgets}
          initialNodes={boardData?.nodes}
          initialEdges={boardData?.edges}
          onBoardChange={handleBoardChange}
          onRemoveWidget={removeWidget}
          sessionId={activeSessionId}
          pendingActions={pendingCanvasActions}
          onActionsConsumed={() => setPendingCanvasActions([])}
        />
      </div>

      {/* ── Drag Handle ─────────────────────────────────── */}
      <div
        onMouseDown={handleDragStart}
        style={{
          width: "4px",
          cursor: "col-resize",
          background: "transparent",
          zIndex: 10,
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      />

      {/* ── Chat Panel ─────────────────────────────────── */}
      <div style={{
        width: `${chatWidth}px`,
        minWidth: "300px",
        height: "100%",
        borderLeft: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-sidebar)",
        overflow: "hidden",
      }}>
        <ChatInterface
          onNewWidget={handleNewWidget}
          sessionId={activeSessionId}
          onSessionCreated={handleSessionCreated}
          restoredMessages={restoredMessages}
        />
      </div>

    </div>
  );
}
