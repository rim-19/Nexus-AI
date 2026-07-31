"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Github, Loader2, Cpu, Layers, ShieldAlert, FileCode, Boxes, Sparkles } from "lucide-react";
import { getOverview, type RepoOverview } from "@/lib/api";

const complexityColor: Record<string, string> = {
  Low: "text-brand-lime", Moderate: "text-amber-300", High: "text-destructive",
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value || "—"}</div>
    </div>
  );
}

export function RepoOverview({ docId, sourceRef, onClose }: {
  docId: string | null; sourceRef?: string; onClose: () => void;
}) {
  const [data, setData] = useState<RepoOverview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docId) { setData(null); return; }
    setLoading(true); setData(null);
    getOverview(docId).then((r) => setData(r.overview)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [docId]);

  return (
    <AnimatePresence>
      {docId && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="glass-strong fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-brand-cyan" />
                <span className="truncate text-sm font-medium">Repository Overview</span>
                <span className="truncate font-mono text-xs text-muted-foreground">· {sourceRef}</span>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div data-lenis-prevent className="flex-1 space-y-5 overflow-y-auto p-5">
              {loading && (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating intelligence report…
                </div>
              )}
              {!loading && !data && (
                <p className="p-6 text-sm text-muted-foreground">Overview unavailable for this repository.</p>
              )}
              {data && (
                <>
                  {/* AI summary */}
                  <div className="glass-strong rounded-xl p-4"
                    style={{ boxShadow: "0 0 40px -16px hsl(var(--brand-purple)/0.5)" }}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-brand-cyan">
                      <Sparkles className="h-3.5 w-3.5" /> AI Summary
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">{data.summary}</p>
                  </div>

                  {/* fields grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Language" value={data.language} />
                    <Field label="Framework" value={data.framework} />
                    <Field label="Architecture" value={data.architecture} />
                    <div className="glass rounded-xl p-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Complexity</div>
                      <div className={`mt-0.5 text-sm font-medium ${complexityColor[data.complexity] || ""}`}>{data.complexity || "—"}</div>
                    </div>
                  </div>

                  {/* key technologies */}
                  {data.key_technologies?.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><Cpu className="h-3.5 w-3.5" /> Key Technologies</div>
                      <div className="flex flex-wrap gap-1.5">
                        {data.key_technologies.map((t) => (
                          <span key={t} className="glass rounded-full px-2.5 py-1 text-xs text-foreground/80">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* modules */}
                  {data.modules?.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><Layers className="h-3.5 w-3.5" /> Detected Modules</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {data.modules.map((m) => (
                          <div key={m} className="glass flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs">
                            <Boxes className="h-3.5 w-3.5 text-brand-purple" /> {m}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* key files */}
                  {data.key_files?.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><FileCode className="h-3.5 w-3.5" /> Key Files</div>
                      <div className="space-y-1">
                        {data.key_files.map((f) => (
                          <div key={f} className="font-mono text-xs text-foreground/70">{f}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* security notes */}
                  {data.security_notes?.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> Security Observations</div>
                      <ul className="space-y-1.5">
                        {data.security_notes.map((n, i) => (
                          <li key={i} className="flex gap-2 text-xs text-muted-foreground"><span className="text-amber-300">•</span> {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
