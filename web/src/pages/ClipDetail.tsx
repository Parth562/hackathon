import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/api/client";
import { StatusBadge } from "@/components/status-badge";
import { speakerColor } from "@/lib/speaker-color";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Download, RefreshCw, AlertTriangle, Pencil, Check, X, ChevronDown,
} from "lucide-react";

const API_KEY = () => localStorage.getItem("api_key") || "change-me";
const EXPORT_FORMATS = ["srt", "vtt", "rttm", "json", "txt"];

export default function ClipDetail() {
  const { id } = useParams();
  const [result, setResult] = useState<any>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [reprocessing, setReprocessing] = useState(false);

  async function load() {
    if (id) setResult(await api.getResult(id));
  }
  useEffect(() => { load(); }, [id]);

  if (!result) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const { clip, quality, speakers, utterances, run } = result;
  const warnings: any[] = run?.warnings || [];

  async function assign(label: string, body: object) {
    if (!id) return;
    await api.assignSpeaker(id, label, body);
    setAssigning(null);
    setName("");
    toast.success("Speaker updated");
    load();
  }

  async function reprocess() {
    if (!id) return;
    setReprocessing(true);
    try {
      await api.reprocess(id);
      toast.success("Reprocessing queued");
      setTimeout(load, 1500);
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between border-b border-border px-8 py-6">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-7 gap-1 text-muted-foreground">
            <Link to="/"><ArrowLeft className="size-3.5" /> Library</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{clip.filename}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">{clip.duration_s?.toFixed(1)}s</span>
            <Separator />
            <span className="uppercase">{clip.language || "—"}</span>
            <Separator />
            <StatusBadge status={clip.status} />
            {quality && (
              <>
                <Separator />
                <Badge variant="outline" className={
                  quality.grade === "good" ? "border-success/30 bg-success/10 text-success"
                    : quality.grade === "fair" ? "border-warning/30 bg-warning/10 text-warning"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                }>
                  {quality.grade} quality
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={reprocess} disabled={reprocessing}>
            <RefreshCw className={`size-3.5 ${reprocessing ? "animate-spin" : ""}`} />
            Reprocess
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="size-3.5" /> Export <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {EXPORT_FORMATS.map((fmt) => (
                <DropdownMenuItem key={fmt} asChild>
                  <a href={`/v1/clips/${id}/export/${fmt}?key=${API_KEY()}`} className="uppercase">
                    {fmt}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-8 py-6">
        <audio
          controls
          src={`/v1/clips/${id}/audio?key=${API_KEY()}`}
          className="w-full rounded-xl"
        />

        {warnings.map((w, i) => (
          <Alert key={i} variant="destructive" className="border-warning/30 bg-warning/10 text-warning [&>svg]:text-warning">
            <AlertTriangle className="size-4" />
            <AlertTitle>{w.code.replaceAll("_", " ")}</AlertTitle>
            {Object.keys(w).length > 1 && (
              <AlertDescription className="text-warning/80">
                {Object.entries(w).filter(([k]) => k !== "code").map(([k, v]) => `${k}: ${v}`).join(" · ")}
              </AlertDescription>
            )}
          </Alert>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Speakers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(speakers || []).map((s: any) => (
              <div key={s.local_label} className="flex items-center gap-4 rounded-lg border border-border p-3">
                <span className={cn("size-2.5 shrink-0 rounded-full", speakerColor(s.local_label).dot)} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.display_name || s.local_label}</span>
                    <Badge variant="secondary" className="text-xs">{s.match_result}</Badge>
                    {s.match_score != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">score {s.match_score.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={(s.talk_share || 0) * 100} className="h-1.5 w-40" />
                    <span className="text-xs tabular-nums text-muted-foreground">{((s.talk_share || 0) * 100).toFixed(0)}% talk</span>
                    <span className="text-xs tabular-nums text-muted-foreground">· reliability {(s.reliability || 0).toFixed(2)}</span>
                  </div>
                </div>

                {assigning === s.local_label ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      autoFocus
                      placeholder="Speaker name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-8 w-40"
                    />
                    <Button size="icon" className="size-8" onClick={() => assign(s.local_label, { create_profile: { display_name: name }, enroll: true })}>
                      <Check className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="outline" className="size-8" onClick={() => assign(s.local_label, { mark_unknown: true })}>
                      <X className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => setAssigning(null)}>
                      <X className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setAssigning(s.local_label)}>
                    <Pencil className="size-3.5" /> Correct
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(utterances || []).map((u: any) => (
              <div key={u.id} className="flex gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
                <span className={cn(
                  "mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  speakerColor(u.local_label).chip
                )}>
                  {u.local_label}
                </span>
                <p
                  className="leading-relaxed"
                  title={`word conf ${u.mean_word_conf?.toFixed(2)} · speaker conf ${u.mean_speaker_conf?.toFixed(2)}`}
                >
                  {u.text}
                </p>
              </div>
            ))}
            {(!utterances || utterances.length === 0) && (
              <p className="py-4 text-center text-sm text-muted-foreground">No transcript available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Separator() {
  return <span className="text-border">·</span>;
}
