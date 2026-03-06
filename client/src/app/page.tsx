"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import SessionSidebar from "@/components/SessionSidebar";
import ChatInterface from "@/components/ChatInterface";
import { fetchSession, saveBoardState, pushCanvasState, pollCanvasActions } from "@/lib/api";

const DynamicBoard = dynamic(() => import("@/components/DynamicBoard"), { ssr: false });

export default function Home() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [widgets, setWidgets] = useState<any[]>([]);
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
    if (!activeSessionId) { setWidgets([]); setRestoredMessages(null); return; }
    if (sessionFromCreationRef.current) {
      // Session was just created — widgets already populated, don't overwrite
      sessionFromCreationRef.current = false;
      return;
    }
    // Explicit session selection from sidebar — load persisted board + messages
    fetchSession(activeSessionId)
      .then((s) => {
        // Each persisted board item is raw widget data — re-wrap with an id
        const restored = (s.board_state ?? []).map((item: any, i: number) => ({
          id: item._widgetId ?? `restored-${Date.now()}-${i}`,
          data: item,
        }));
        setWidgets(restored);
        setRestoredMessages(s.messages ?? []);
      })
      .catch(() => { setWidgets([]); setRestoredMessages([]); });
  }, [activeSessionId]);

  // Auto-save board state (debounced 2s after last change)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistBoard = useCallback((newWidgets: any[]) => {
    if (!activeSessionId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveBoardState(activeSessionId, newWidgets.map((w) => w.data)).catch(() => { });
    }, 2000);
  }, [activeSessionId]);

  const handleNewWidget = useCallback((widgetData: any) => {
    setWidgets((prev) => {
      const newId = Date.now().toString() + "-" + Math.floor(Math.random() * 1e6);
      const next = [{ id: newId, data: { ...widgetData, _widgetId: newId } }, ...prev];
      persistBoard(next);
      return next;
    });
  }, [persistBoard]);

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => {
      const next = prev.filter((w) => w.id !== id);
      persistBoard(next);
      return next;
    });
  }, [persistBoard]);

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

  // Push canvas state to backend whenever session is active (debounced via save timer)
  useEffect(() => {
    if (!activeSessionId || widgets.length === 0) return;
    // Push lightweight summary (just id + widget_type) for LLM context
    const nodesSummary = widgets.map((w) => ({
      id: w.id,
      type: "customWidget",
      data: { widgetData: { type: w.data?.type, widget_type: w.data?.widget_type, ticker: w.data?.ticker } },
    }));
    pushCanvasState(activeSessionId, nodesSummary, []);
  }, [widgets, activeSessionId]);

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
