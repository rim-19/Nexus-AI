"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Github, FileText, FileCode, Trash2, Loader2, UploadCloud, MoreHorizontal, CheckCircle2, Clock } from "lucide-react";
import { Input, Button, Badge } from "@/components/ui";
import { ChunkBurst } from "@/components/ChunkBurst";
import { RobotEmpty } from "@/components/RobotEmpty";
import { sfx } from "@/lib/sound";
import { listDocuments, addGithub, uploadFile, deleteDocument, getFiles, type Doc } from "@/lib/api";

const statusStyle: Record<Doc["status"], string> = {
  pending: "bg-amber-400/15 text-amber-300",
  indexing: "bg-amber-400/15 text-amber-300",
  ready: "bg-brand-lime/15 text-brand-lime",
  failed: "bg-red-400/15 text-red-300",
};

const LANG: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
  py: "Python", go: "Go", rs: "Rust", java: "Java", rb: "Ruby", php: "PHP",
  c: "C", cpp: "C++", cs: "C#", swift: "Swift", kt: "Kotlin",
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function dateBucket(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}
function topLanguage(paths: string[]) {
  const c: Record<string, number> = {};
  for (const p of paths) {
    const l = LANG[p.split(".").pop() || ""];
    if (l) c[l] = (c[l] || 0) + 1;
  }
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0];
}

type FileInfo = { files: number; language?: string };

export function DocumentsPanel({ cid, onReadyDoc }: { cid: string; onReadyDoc?: (docs: Doc[]) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [info, setInfo] = useState<Record<string, FileInfo>>({});
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const d = await listDocuments(cid);
    setDocs(d.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)));
    onReadyDoc?.(d.filter((x) => x.status === "ready"));
  }
  useEffect(() => { refresh().catch((e) => setErr(e.message)); }, [cid]);

  useEffect(() => {
    if (!docs.some((d) => d.status === "pending" || d.status === "indexing")) return;
    const t = setInterval(() => refresh().catch(() => {}), 2500);
    return () => clearInterval(t);
  }, [docs]);

  // fetch file breakdown for ready github repos (once each)
  useEffect(() => {
    docs.filter((d) => d.status === "ready" && d.source_type === "github" && !info[d.id]).forEach((d) => {
      getFiles(d.id).then((r) => {
        setInfo((m) => ({ ...m, [d.id]: { files: r.files.length, language: topLanguage(r.files.map((f) => f.file_path)) } }));
      }).catch(() => {});
    });
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
    setMenu(null);
    await deleteDocument(id).catch((e) => setErr(e.message));
    await refresh();
  }

  // group by date bucket (docs already newest-first)
  const buckets: { label: string; items: Doc[] }[] = [];
  for (const d of docs) {
    const b = dateBucket(d.created_at);
    (buckets.find((x) => x.label === b) ?? buckets[buckets.push({ label: b, items: [] }) - 1]).items.push(d);
  }

  return (
    <div className="space-y-6">
      {/* ── Add Sources ── */}
      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add Sources</h2>

        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
          onClick={() => fileRef.current?.click()}
          animate={{ scale: drag ? 1.02 : 1 }}
          className={`group relative flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-xl border-dashed py-6 text-center transition-colors ${
            drag ? "glass border-brand-cyan shadow-[0_0_36px_-8px_hsl(var(--brand-cyan)/0.7)]" : "glass border-white/10"}`}
          style={{ borderWidth: 1.5 }}>
          {/* floating file-type icons */}
          <div className="flex items-end gap-2">
            {[FileText, FileCode, Github, UploadCloud].map((Ic, i) => (
              <motion.span key={i}
                animate={{ y: drag ? [-2, -8, -2] : [0, -4, 0] }}
                transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                className={`grid h-8 w-8 place-items-center rounded-lg bg-white/5 ${i === 3 ? "text-brand-cyan" : "text-brand-purple"}`}>
                <Ic className="h-4 w-4" />
              </motion.span>
            ))}
          </div>
          <p className="text-xs font-medium">{drag ? "Drop to ingest" : "Drop a file or click to upload"}</p>
          <p className="font-mono text-[10px] text-muted-foreground">PDF · DOCX · MD · TXT</p>
        </motion.div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.md,.txt"
          onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />

        <form onSubmit={addRepo} className="mt-2.5 flex gap-2">
          <Input placeholder="owner/repo or GitHub URL" value={url}
            onChange={(e) => setUrl(e.target.value)} className="glass border-white/10 text-sm" />
          <Button type="submit" size="sm" variant="accent" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
          </Button>
        </form>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </section>

      {/* ── Connected Sources ── */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Connected Sources</h2>
          {docs.length > 0 && <span className="font-mono text-[10px] text-muted-foreground">{docs.length}</span>}
        </div>

        {docs.length === 0 && <RobotEmpty title="No sources yet" subtitle="Drop a doc or add a repo" />}

        {buckets.map((b) => (
          <div key={b.label} className="mb-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              <Clock className="h-3 w-3" /> {b.label}
            </div>
            <div className="space-y-2.5">
              {b.items.map((d) => {
                const fi = info[d.id];
                return (
                  <motion.div key={d.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    className="glass relative rounded-xl p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-blue/20 to-brand-purple/20">
                        {d.source_type === "github" ? <Github className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-xs text-foreground/90">{d.source_ref}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Badge className={statusStyle[d.status]}>
                            {(d.status === "indexing" || d.status === "pending") && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            {d.status === "ready" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                            {d.status}
                          </Badge>
                          {d.status === "ready" && (
                            <>
                              <span className="font-mono text-[10px] text-muted-foreground">{d.num_chunks} chunks</span>
                              {fi?.files ? <span className="font-mono text-[10px] text-muted-foreground">· {fi.files} files</span> : null}
                              {fi?.language && <span className="rounded bg-brand-cyan/15 px-1.5 font-mono text-[9px] text-brand-cyan">{fi.language}</span>}
                            </>
                          )}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground/70">Updated {timeAgo(d.created_at)}</div>
                      </div>
                      <button onClick={() => setMenu(menu === d.id ? null : d.id)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    <AnimatePresence>
                      {menu === d.id && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="glass-strong absolute right-2 top-9 z-10 rounded-lg p-1">
                          <button onClick={() => remove(d.id)}
                            className="flex items-center gap-2 rounded px-2 py-1 text-xs text-destructive hover:bg-white/5">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {(d.status === "indexing" || d.status === "pending") && <div className="mt-2.5"><ChunkBurst /></div>}
                    {d.status === "failed" && d.error && <div className="mt-2 text-xs text-destructive">{d.error}</div>}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
