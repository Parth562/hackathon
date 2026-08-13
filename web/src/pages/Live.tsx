import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Mood, MOOD_STYLE, moodDot } from "@/lib/mood";
import { Mic, Square, Loader2 } from "lucide-react";

// longer chunks = fewer mid-word cuts at chunk boundaries (a real accuracy cost —
// each cut splits a word across two independent ASR calls, garbling both halves).
// GPU transcription is ~1s per chunk, so 7s chunks still feel responsive.
const CHUNK_MS = 7000;

type ChunkStatus = "pending" | "done" | "error";
type Chunk = { seq: number; text: string; status: ChunkStatus; mood?: Mood };

export default function Live() {
  const [recording, setRecording] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // MediaRecorder chunks from a single continuous recording aren't independently
  // decodable (only the first has a full container header) — so each ~5s window is
  // its own start/stop recorder instance, each producing one self-contained webm file.
  function recordOneChunk(stream: MediaStream) {
    if (stopRequestedRef.current) return;
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    recorderRef.current = recorder;
    const seq = seqRef.current++;
    const parts: BlobPart[] = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(parts, { type: "audio/webm" });
      setChunks((prev) => [...prev, { seq, text: "", status: "pending" }]);
      try {
        await api.uploadLiveChunk(sessionIdRef.current!, seq, blob);
      } catch {
        setChunks((prev) => prev.map((c) => (c.seq === seq ? { ...c, status: "error" } : c)));
      }
      if (!stopRequestedRef.current && streamRef.current) recordOneChunk(streamRef.current);
    };
    recorder.start();
    setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, CHUNK_MS);
  }

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    stopRequestedRef.current = false;
    seqRef.current = 0;
    setChunks([]);

    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;

    const ws = new WebSocket(`${location.origin.replace("http", "ws")}/v1/ws/jobs/${sessionId}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as { type: string; seq: number; text: string; mood?: Mood; error?: string };
      if (msg.type !== "live_transcript") return;
      setChunks((prev) => prev.map((c) =>
        c.seq === msg.seq ? { ...c, text: msg.text, mood: msg.mood, status: msg.error ? "error" : "done" } : c));
    };
    wsRef.current = ws;

    setRecording(true);
    recordOneChunk(stream);
  }

  function stop() {
    stopRequestedRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    setRecording(false);
  }

  const transcript = chunks.map((c) => c.text).filter(Boolean).join(" ");
  const pendingCount = chunks.filter((c) => c.status === "pending").length;
  const doneChunks = chunks.filter((c) => c.status === "done" && c.mood);
  const currentMood = doneChunks.length ? doneChunks[doneChunks.length - 1].mood : undefined;

  return (
    <div>
      <PageHeader
        title="Live transcription"
        description="Speak into your mic — transcript and stress read appear in ~5-8s chunks. Diarization and full audio quality analysis aren't run live; upload the recording afterward for the full pipeline."
      />

      <div className="mx-auto max-w-2xl px-8 py-8">
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={recording ? stop : start}
            size="lg"
            variant={recording ? "destructive" : "default"}
            className="gap-2 rounded-full px-8"
          >
            {recording ? <Square className="size-4 fill-current" /> : <Mic className="size-4" />}
            {recording ? "Stop" : "Start listening"}
          </Button>
          {currentMood && (
            <Badge variant="outline" className={cn("h-9 rounded-full px-4 text-sm capitalize", MOOD_STYLE[currentMood])}>
              {currentMood}
            </Badge>
          )}
        </div>

        {recording && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-destructive" />
            </span>
            recording — {pendingCount > 0 && <Loader2 className="size-3 animate-spin" />}
            {pendingCount > 0 ? `transcribing chunk ${chunks.length - pendingCount + 1}` : "listening"}
          </div>
        )}

        {chunks.length > 0 && (
          <div className="mt-8 animate-slide-up rounded-xl border border-border bg-card p-5">
            {doneChunks.length > 0 && (
              <div className="mb-4 flex items-center gap-1">
                {chunks.map((c) => (
                  <span
                    key={c.seq}
                    title={c.mood ? `chunk ${c.seq}: ${c.mood}` : `chunk ${c.seq}`}
                    className={cn(
                      "h-2 flex-1 rounded-full",
                      c.mood ? moodDot(c.mood) : "bg-muted"
                    )}
                  />
                ))}
              </div>
            )}

            <p className="mb-2 text-xs font-medium text-muted-foreground">Live transcript</p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {transcript || <span className="text-muted-foreground">Listening…</span>}
              {pendingCount > 0 && <span className="animate-pulse text-muted-foreground"> …</span>}
            </p>

            <div className="mt-4 space-y-1 border-t border-border pt-3">
              {chunks.map((c) => (
                <div key={c.seq} className={cn("flex items-center gap-2 text-xs", "text-muted-foreground")}>
                  <span className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    c.status === "pending" && "bg-warning animate-pulse",
                    c.status === "done" && "bg-success",
                    c.status === "error" && "bg-destructive"
                  )} />
                  chunk {c.seq}
                  {c.mood && c.status === "done" && (
                    <span className={cn("rounded px-1.5 py-0.5 capitalize", MOOD_STYLE[c.mood])}>{c.mood}</span>
                  )}
                  {c.status === "error" && " — failed"}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
