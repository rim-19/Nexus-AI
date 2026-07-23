"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Header } from "@/components/Header";
import { Background } from "@/components/Background";
import { StatsRow } from "@/components/StatsRow";
import {
  isAuthed, listWorkspaces, listCollections, listDocuments, getFiles,
  type Doc, type FileStat,
} from "@/lib/api";

function Bars({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div key={r.label + i} className="flex items-center gap-3 text-xs">
            <span className="w-40 shrink-0 truncate font-mono text-muted-foreground">{r.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-cyan"
                initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }}
                transition={{ duration: 0.9, delay: i * 0.06, ease: "easeOut" }} />
            </div>
            <span className="w-12 text-right font-mono text-brand-cyan">{r.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [files, setFiles] = useState<FileStat[]>([]);

  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    (async () => {
      const ws = await listWorkspaces();
      const cols = (await Promise.all(ws.map((w) => listCollections(w.id)))).flat();
      const allDocs = (await Promise.all(cols.map((c) => listDocuments(c.id)))).flat();
      setDocs(allDocs);
      const biggest = allDocs.filter((d) => d.status === "ready").sort((a, b) => b.num_chunks - a.num_chunks)[0];
      if (biggest) getFiles(biggest.id).then((r) => setFiles(r.files.slice(0, 10))).catch(() => {});
    })().catch(() => {});
  }, [router]);

  return (
    <div className="min-h-screen">
      <Background />
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-1 text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mb-6 text-sm text-muted-foreground">Live metrics across your knowledge base.</p>

        <StatsRow />

        <div className="grid gap-4 lg:grid-cols-2">
          <Bars title="Documents by chunks"
            rows={docs.map((d) => ({ label: d.source_ref, value: d.num_chunks })).sort((a, b) => b.value - a.value).slice(0, 10)} />
          <Bars title="Top files by chunks"
            rows={files.map((f) => ({ label: f.file_path.split("/").pop() || f.file_path, value: f.chunks }))} />
        </div>
      </main>
    </div>
  );
}
