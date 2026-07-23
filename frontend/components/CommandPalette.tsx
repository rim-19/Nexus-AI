"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Search, Folder, FileText, Github, CornerDownLeft } from "lucide-react";
import { search as apiSearch, isAuthed, type SearchResults } from "@/lib/api";

type Item = { kind: "collection" | "document"; id: string; label: string; collectionId: string; icon: "folder" | "file" | "github" };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // global Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isAuthed()) setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => { if (isAuthed()) setOpen(true); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("nexus:command", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("nexus:command", onOpen); };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(""); setItems([]); setActive(0); }
  }, [open]);

  // debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!q.trim()) { setItems([]); return; }
      try {
        const r: SearchResults = await apiSearch(q.trim());
        const mapped: Item[] = [
          ...r.collections.map((c) => ({ kind: "collection" as const, id: c.id, label: c.name, collectionId: c.id, icon: "folder" as const })),
          ...r.documents.map((d) => ({ kind: "document" as const, id: d.id, label: d.source_ref, collectionId: d.collection_id, icon: (d.source_type === "github" ? "github" : "file") as "github" | "file" })),
        ];
        setItems(mapped); setActive(0);
      } catch { setItems([]); }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = useCallback((it: Item) => {
    setOpen(false);
    router.push(`/collections/${it.collectionId}`);
  }, [router]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active]); }
  }

  const Icon = ({ k }: { k: Item["icon"] }) =>
    k === "folder" ? <Folder className="h-4 w-4 text-brand-cyan" />
    : k === "github" ? <Github className="h-4 w-4 text-muted-foreground" />
    : <FileText className="h-4 w-4 text-muted-foreground" />;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[18vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }} transition={{ duration: 0.18 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="glass-strong relative z-10 w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Search collections and documents…"
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {items.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {q.trim() ? "No matches" : "Type to search your knowledge base"}
                </div>
              )}
              {items.map((it, i) => (
                <button key={it.kind + it.id} onMouseEnter={() => setActive(i)} onClick={() => go(it)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    i === active ? "bg-brand-blue/15" : "hover:bg-white/5"}`}>
                  <Icon k={it.icon} />
                  <span className="flex-1 truncate">{it.label}</span>
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">{it.kind}</span>
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
