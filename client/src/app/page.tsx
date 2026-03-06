"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import SessionSidebar from "@/components/SessionSidebar";
import ChatInterface from "@/components/ChatInterface";
import { fetchSession, saveBoardState } from "@/lib/api";

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
        setWidgets(s.board_state ?? []);
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
      const next = [{ id: Date.now().toString() + Math.random(), data: widgetData }, ...prev];
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

  const handleNewChat = () => {
    setActiveSessionId(null);
    setWidgets([]);
    setRestoredMessages(null);
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
        />
      </div>

      {/* ── Chat Panel ─────────────────────────────────── */}
      <div style={{
        width: "380px",
        minWidth: "340px",
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
