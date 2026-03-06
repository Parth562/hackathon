/**
 * Thin typed API client.
 * All fetch calls live here — components never call fetch() directly.
 */
import {
    SessionListSchema, SessionDetailSchema,
    DocumentListSchema, SearchResultsSchema,
    type SessionMeta, type SessionDetail, type ChatRequest,
} from "./schemas";

const BASE = "http://localhost:8261";

async function json<T>(res: Response, parse: (v: unknown) => T): Promise<T> {
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`API ${res.status}: ${text}`);
    }
    return parse(await res.json());
}

// ── Models ────────────────────────────────────────────
export async function fetchModels(): Promise<Array<{ id: string; name: string; provider: "google" | "ollama" }>> {
    const res = await fetch(`${BASE}/api/models`);
    const data = await res.json();
    return ((data.models ?? []) as Array<{ id: string; name: string; provider: string }>)
        .map((m) => ({ ...m, provider: (m.provider === "ollama" ? "ollama" : "google") as "google" | "ollama" }));
}

// ── Sessions ──────────────────────────────────────────
export async function fetchSessions(): Promise<SessionMeta[]> {
    const res = await fetch(`${BASE}/api/sessions`);
    const parsed = SessionListSchema.parse(await res.json());
    return parsed.sessions;
}

export async function fetchSession(id: string): Promise<SessionDetail> {
    const res = await fetch(`${BASE}/api/sessions/${id}`);
    return json(res, (v) => SessionDetailSchema.parse(v));
}

export async function saveBoardState(sessionId: string, boardState: unknown[]) {
    await fetch(`${BASE}/api/sessions/${sessionId}/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_state: boardState }),
    });
}

export async function deleteSession(id: string) {
    await fetch(`${BASE}/api/sessions/${id}`, { method: "DELETE" });
}

// ── Documents ─────────────────────────────────────────
export async function fetchDocuments(): Promise<string[]> {
    const res = await fetch(`${BASE}/api/documents`);
    return (DocumentListSchema.parse(await res.json())).documents;
}

export async function uploadDocument(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error("Upload failed: " + res.statusText);
    return res.json() as Promise<{ message: string; filename: string }>;
}

export async function deleteDocument(filename: string) {
    await fetch(`${BASE}/api/documents/${encodeURIComponent(filename)}`, { method: "DELETE" });
}

export async function searchDocuments(query: string, limit = 5) {
    const res = await fetch(`${BASE}/api/documents/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit }),
    });
    return (SearchResultsSchema.parse(await res.json())).results;
}

// ── Chat (streaming) ──────────────────────────────────
export function streamChat(payload: ChatRequest, signal: AbortSignal) {
    return fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
    });
}

// ── Canvas State ──────────────────────────────────────
export async function pushCanvasState(sessionId: string, nodes: unknown[], edges: unknown[]) {
    await fetch(`${BASE}/api/canvas/${sessionId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
    }).catch(() => { /* ignore network errors silently */ });
}

export async function pollCanvasActions(sessionId: string): Promise<any[]> {
    const res = await fetch(`${BASE}/api/canvas/${sessionId}/actions`).catch(() => null);
    if (!res || !res.ok) return [];
    const data = await res.json().catch(() => ({ actions: [] }));
    return data.actions ?? [];
}
