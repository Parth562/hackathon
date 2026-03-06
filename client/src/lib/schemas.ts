/**
 * Centralised Zod schemas for all API request / response types.
 * Import from here everywhere — never write raw fetch responses as `any`.
 */
import { z } from "zod";

// ── Models ────────────────────────────────────────────
export const ModelSchema = z.object({
    id: z.string(),
    name: z.string(),
    provider: z.enum(["google", "ollama"]),
});
export type Model = z.infer<typeof ModelSchema>;

// ── Chat ──────────────────────────────────────────────
export const ChatRequestSchema = z.object({
    message: z.string().min(1, "Message cannot be empty"),
    session_id: z.string().optional(),
    model_name: z.string().default("gemini-2.5-flash"),
    provider: z.string().default("google"),
    forced_mode: z.enum(["QUICK", "DEEP"]).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const StreamEventSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("status"), content: z.string() }),
    z.object({ type: z.literal("token"), content: z.string() }),
    z.object({ type: z.literal("error"), content: z.string() }),
    z.object({
        type: z.literal("result"),
        response: z.string(),
        session_id: z.string(),
        mode: z.string(),
    }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

// ── Sessions ──────────────────────────────────────────
export const SessionMetaSchema = z.object({
    id: z.string(),
    title: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
});
export type SessionMeta = z.infer<typeof SessionMetaSchema>;

export const SessionDetailSchema = SessionMetaSchema.extend({
    board_state: z.array(z.any()),
    messages: z.array(z.object({ role: z.string(), content: z.string() })).default([]),
});
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

export const SessionListSchema = z.object({
    sessions: z.array(SessionMetaSchema),
});

// ── Documents ─────────────────────────────────────────
export const DocumentListSchema = z.object({
    documents: z.array(z.string()),
});

export const SearchResultSchema = z.object({
    text: z.string(),
    source: z.string(),
    score: z.number().nullable(),
    page: z.number().nullable().optional(),
});
export const SearchResultsSchema = z.object({
    results: z.array(SearchResultSchema),
});

// ── Alerts ────────────────────────────────────────────
export const AlertRequestSchema = z.object({
    ticker: z.string().min(1).max(10).toUpperCase(),
    condition: z.string().default("negative_fcf"),
});
export type AlertRequest = z.infer<typeof AlertRequestSchema>;
