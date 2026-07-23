"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, FileText, Loader2 } from "lucide-react";
import { getSource, type Citation, type SourceFile, type SourceChunk } from "@/lib/api";

function matches(c: SourceChunk, cit: Citation): boolean {
  if (cit.start_line != null && cit.end_line != null)
    return c.start_line === cit.start_line && c.end_line === cit.end_line;
  if (cit.page != null) return c.page === cit.page;
  return false;
}

export function SourceViewer({ citation, onClose }: { citation: Citation | null; onClose: () => void }) {
  const [data, setData] = useState<SourceFile | null>(null);
  const [loading, setLoading] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!citation) { setData(null); return; }
    setLoading(true); setData(null);
    getSource(citation.document_id, citation.file_path)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [citation]);

  useEffect(() => {
    if (data) setTimeout(() => activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  }, [data]);

  return (
    <AnimatePresence>
      {citation && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="glass-strong fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-brand-cyan" />
                <span className="truncate font-mono text-sm">{citation.file_path || citation.label}</span>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading && (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Opening source…
                </div>
              )}
              {data && data.chunks.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground">No indexed content for this file.</p>
              )}
              {data && data.chunks.map((c, i) => {
                const active = matches(c, citation);
                return (
                  <div key={i} ref={active ? activeRef : undefined}
                    className={`mb-3 rounded-lg border p-3 transition-colors ${
                      active
                        ? "border-brand-cyan/60 bg-brand-cyan/5 shadow-[0_0_40px_-10px_hsl(var(--brand-cyan)/0.8)]"
                        : "border-white/5 bg-white/[0.02]"}`}>
                    <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                      {c.symbol_name && <span className="text-brand-purple">{c.symbol_name}</span>}
                      {c.start_line != null && <span>L{c.start_line}–{c.end_line}</span>}
                      {c.page != null && <span>page {c.page}</span>}
                      {active && <span className="rounded bg-brand-cyan/20 px-1.5 text-brand-cyan">cited</span>}
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">{c.content}</pre>
                  </div>
                );
              })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
