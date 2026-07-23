"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { getFiles, type Doc, type FileStat } from "@/lib/api";

/** Radial "knowledge map" of the active document's files. Click a node to open the file. */
export function KnowledgeGraph({ readyDocs, onOpenFile }: {
  readyDocs: Doc[];
  onOpenFile: (documentId: string, filePath: string) => void;
}) {
  const [files, setFiles] = useState<FileStat[]>([]);
  const doc = readyDocs.find((d) => d.source_type === "github") ?? readyDocs[0];

  useEffect(() => {
    if (!doc) { setFiles([]); return; }
    getFiles(doc.id).then((r) => setFiles(r.files.slice(0, 12))).catch(() => setFiles([]));
  }, [doc?.id]);

  if (!doc || files.length === 0) {
    return (
      <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
        Knowledge map appears once a source is indexed.
      </div>
    );
  }

  const cx = 100, cy = 100, R = 74;
  const maxChunks = Math.max(...files.map((f) => f.chunks));
  const nodes = files.map((f, i) => {
    const a = (i / files.length) * Math.PI * 2 - Math.PI / 2;
    return { f, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, r: 3 + (f.chunks / maxChunks) * 4 };
  });
  const short = (p: string) => p.split("/").pop() || p;

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Knowledge Map</h2>
      <svg viewBox="0 0 200 200" className="w-full flex-1">
        {nodes.map((n, i) => (
          <motion.line key={"l" + i} x1={cx} y1={cy} x2={n.x} y2={n.y}
            stroke="hsl(var(--brand-blue))" strokeWidth="0.5"
            initial={{ opacity: 0.1 }} animate={{ opacity: [0.1, 0.5, 0.1] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.15 }} />
        ))}
        {/* center brain node */}
        <circle cx={cx} cy={cy} r="9" fill="hsl(var(--brand-blue) / 0.25)" />
        <circle cx={cx} cy={cy} r="5" fill="hsl(var(--brand-cyan))" />
        {nodes.map((n, i) => (
          <g key={"n" + i} className="cursor-pointer" onClick={() => onOpenFile(doc.id, n.f.file_path)}>
            <title>{n.f.file_path} · {n.f.chunks} chunks</title>
            <motion.circle cx={n.x} cy={n.y} r={n.r}
              fill="hsl(var(--brand-purple))" stroke="hsl(var(--brand-cyan))" strokeWidth="0.4"
              whileHover={{ scale: 1.6 }}
              initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }} />
          </g>
        ))}
      </svg>
      <div className="mt-1 max-h-24 space-y-0.5 overflow-y-auto">
        {files.slice(0, 6).map((f) => (
          <button key={f.file_path} onClick={() => onOpenFile(doc.id, f.file_path)}
            className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-0.5 text-left font-mono text-[10px] text-muted-foreground hover:bg-white/5 hover:text-foreground">
            <span className="truncate">{short(f.file_path)}</span>
            <span className="text-brand-cyan">{f.chunks}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
