"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Github, FileText, Trash2, Loader2, UploadCloud } from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import { ChunkBurst } from "@/components/ChunkBurst";
import { RobotEmpty } from "@/components/RobotEmpty";
import { sfx } from "@/lib/sound";
import { listDocuments, addGithub, uploadFile, deleteDocument, type Doc } from "@/lib/api";

const statusStyle: Record<Doc["status"], string> = {
  pending: "bg-amber-400/15 text-amber-300",
  indexing: "bg-amber-400/15 text-amber-300",
  ready: "bg-emerald-400/15 text-emerald-300",
  failed: "bg-red-400/15 text-red-300",
};

export function DocumentsPanel({ cid, onReadyDoc }: { cid: string; onReadyDoc?: (docs: Doc[]) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const d = await listDocuments(cid);
    setDocs(d);
    onReadyDoc?.(d.filter((x) => x.status === "ready"));
  }
  useEffect(() => { refresh().catch((e) => setErr(e.message)); }, [cid]);

  useEffect(() => {
    if (!docs.some((d) => d.status === "pending" || d.status === "indexing")) return;
    const t = setInterval(() => refresh().catch(() => {}), 2500);
    return () => clearInterval(t);
  }, [docs]);

  async function addRepo(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setErr(""); setBusy(true);
    try { await addGithub(cid, url.trim()); setUrl(""); await refresh(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function handleFile(f: File | undefined) {
    if (!f) return;
    setErr(""); setBusy(true);
    try { await uploadFile(cid, f); sfx.pop(); await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function remove(id: string) {
    await deleteDocument(id).catch((e) => setErr(e.message));
    await refresh();
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources</h2>

        {/* glass dropzone */}
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
          onClick={() => fileRef.current?.click()}
          animate={{ scale: drag ? 1.02 : 1 }}
          className={`glass flex cursor-pointer flex-col items-center gap-1 rounded-xl border-dashed py-5 text-center transition-colors ${
            drag ? "border-brand-cyan bg-brand-cyan/5 shadow-[0_0_30px_-8px_hsl(var(--brand-cyan)/0.6)]" : "border-white/10"}`}
          style={{ borderWidth: 1.5 }}>
          <UploadCloud className={`h-6 w-6 ${drag ? "text-brand-cyan" : "text-muted-foreground"}`} />
          <p className="text-xs">{drag ? "Drop to ingest" : "Drop a file or click to upload"}</p>
          <p className="font-mono text-[10px] text-muted-foreground">PDF · DOCX · MD · TXT</p>
        </motion.div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.md,.txt"
          onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />

        {/* github */}
        <form onSubmit={addRepo} className="mt-2 flex gap-2">
          <Input placeholder="owner/repo or GitHub URL" value={url}
            onChange={(e) => setUrl(e.target.value)} className="glass border-white/10 text-sm" />
          <Button type="submit" size="sm" variant="accent" disabled={busy}><Github className="h-4 w-4" /></Button>
        </form>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {docs.length === 0 && <RobotEmpty title="No sources yet" subtitle="Drop a doc or add a repo" />}
        {docs.map((d) => (
          <motion.div key={d.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            className="glass rounded-lg p-2.5 text-sm">
            <div className="flex items-center gap-2">
              {d.source_type === "github" ? <Github className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-xs">{d.source_ref}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className={statusStyle[d.status]}>
                    {(d.status === "indexing" || d.status === "pending") && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {d.status}
                  </Badge>
                  {d.status === "ready" && <span className="font-mono text-[10px] text-muted-foreground">{d.num_chunks} chunks</span>}
                </div>
              </div>
              <button onClick={() => remove(d.id)} className="text-muted-foreground transition-colors hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {(d.status === "indexing" || d.status === "pending") && <div className="mt-2"><ChunkBurst /></div>}
            {d.status === "failed" && d.error && <div className="mt-1 text-xs text-destructive">{d.error}</div>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
