"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { X, Search, FolderTree, FileText, Github } from "lucide-react";
import { getGraph, type GraphData, type GraphNode } from "@/lib/api";

const GraphCanvas = dynamic(() => import("@/components/GraphCanvas"), { ssr: false });

const COLORS: Record<string, string> = {
  collection: "#22d3ee", document: "#b200ff", file: "#4f8bff",
};

export function GraphExplorer({ cid, onClose }: { cid: string | null; onClose: () => void }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<{ label: string; nonce: number } | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cid) { setData(null); setSelected(null); setFocus(null); return; }
    getGraph(cid).then(setData).catch(() => setData(null));
  }, [cid]);

  useEffect(() => {
    if (!cid) return;
    const measure = () => {
      if (wrapRef.current) setDims({ w: wrapRef.current.clientWidth, h: wrapRef.current.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [cid, data]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setFocus((f) => ({ label: query.trim(), nonce: (f?.nonce ?? 0) + 1 }));
  }

  return (
    <AnimatePresence>
      {cid && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
          {/* header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="text-brand-cyan">◈</span> Knowledge Graph
              {data && <span className="font-mono text-xs text-muted-foreground">· {data.nodes.length} nodes</span>}
            </div>
            <form onSubmit={search} className="glass flex items-center gap-2 rounded-lg px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search nodes…"
                className="w-40 bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
            </form>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COLORS.collection }} /> Collection</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COLORS.document }} /> Document</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COLORS.file }} /> File</span>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>

          {/* graph */}
          <div ref={wrapRef} className="relative flex-1 overflow-hidden">
            {data && dims.w > 0 && (
              <GraphCanvas data={data} width={dims.w} height={dims.h} onSelect={setSelected} focus={focus} />
            )}

            {/* inspect panel */}
            <AnimatePresence>
              {selected && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="glass-strong absolute right-4 top-4 w-64 rounded-xl p-4">
                  <div className="mb-2 flex items-center gap-2">
                    {selected.type === "collection" ? <FolderTree className="h-4 w-4 text-brand-cyan" />
                      : selected.type === "document" ? <Github className="h-4 w-4 text-brand-purple" />
                      : <FileText className="h-4 w-4" style={{ color: COLORS.file }} />}
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{selected.type}</span>
                  </div>
                  <div className="break-words font-mono text-sm">{selected.path || selected.label}</div>
                  {selected.chunks != null && <div className="mt-2 text-xs text-muted-foreground">{selected.chunks} chunks</div>}
                  {selected.status && <div className="mt-1 text-xs text-muted-foreground">status: {selected.status}</div>}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-muted-foreground">
              drag nodes · scroll to zoom · drag background to pan
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
