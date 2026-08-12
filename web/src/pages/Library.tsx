import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/api/client";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioLines, Search, Upload as UploadIcon, AlertTriangle, Users2 } from "lucide-react";

type Clip = {
  id: string; filename: string; duration_s: number; status: string;
  language: string; n_speakers: number; needs_review: boolean; created_at: string;
};

function fmtDuration(s: number) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function Library() {
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [q, setQ] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const navigate = useNavigate();

  async function load() {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (needsReview) params.needs_review = "true";
    const res = await api.listClips(params);
    setClips(res.items);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, needsReview]);

  return (
    <div>
      <PageHeader
        title="Clip Library"
        description="Every processed recording, searchable and reviewable in one place."
        actions={
          <Button asChild>
            <Link to="/upload">
              <UploadIcon className="size-4" />
              Upload clip
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-3 px-8 pt-6">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search filename…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={needsReview ? "default" : "outline"}
          size="sm"
          onClick={() => setNeedsReview((v) => !v)}
          className="gap-1.5"
        >
          <AlertTriangle className="size-3.5" />
          Needs review
        </Button>
      </div>

      <div className="px-8 py-6">
        {clips === null ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center animate-slide-up">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <AudioLines className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No clips yet</p>
              <p className="text-sm text-muted-foreground">Upload your first recording to get started.</p>
            </div>
            <Button asChild size="sm" className="mt-2">
              <Link to="/upload">Upload a clip</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>File</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Speakers</TableHead>
                  <TableHead className="text-right">Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clips.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/clips/${c.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {c.filename}
                        {c.needs_review && (
                          <AlertTriangle className="size-3.5 shrink-0 text-warning" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{fmtDuration(c.duration_s)}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>
                      {c.language ? (
                        <Badge variant="secondary" className="uppercase">{c.language}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.n_speakers != null ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Users2 className="size-3.5" />
                          {c.n_speakers}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(c.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
