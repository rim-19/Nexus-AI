"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, Cpu, Layers, ShieldAlert, FileCode, Boxes, Sparkles, Code2, Blocks, Gauge } from "lucide-react";
import { getOverview, type RepoOverview } from "@/lib/api";

const complexityColor: Record<string, string> = {
  Low: "text-brand-lime", Moderate: "text-amber-300", High: "text-destructive",
};

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="glass rounded-xl p-3.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="truncate text-sm font-medium">{value || "—"}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

export function RepoOverview({ docId, sourceRef, onClose }: {
  docId: string | null; sourceRef?: string; onClose: () => void;
}) {
  const [data, setData] = useState<RepoOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!docId) { setData(null); return; }
    setLoading(true); setData(null);
    getOverview(docId).then((r) => setData(r.overview)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [docId]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {docId && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="glass-strong pointer-events-auto flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl">
              {/* header */}
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-blue/25 to-brand-purple/25 text-brand-cyan">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Repository Overview</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{sourceRef}</div>
                  </div>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>

              {/* body */}
              <div data-lenis-prevent className="flex-1 space-y-5 overflow-y-auto p-6">
                {loading && (
                  <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating intelligence report…
                  </div>
                )}
                {!loading && !data && (
                  <p className="py-16 text-center text-sm text-muted-foreground">Overview unavailable for this repository.</p>
                )}
                {data && (
                  <>
                    {/* AI summary */}
                    <div className="rounded-2xl bg-gradient-to-br from-brand-purple/15 to-brand-blue/10 p-5"
                      style={{ boxShadow: "0 0 60px -24px hsl(var(--brand-purple)/0.6)" }}>
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-brand-cyan">
                        <Sparkles className="h-3.5 w-3.5" /> AI Summary
                      </div>
                      <p className="text-[15px] leading-relaxed text-foreground/90">{data.summary}</p>
                    </div>

                    {/* key fields */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Field icon={<Code2 className="h-3 w-3" />} label="Language" value={data.language} />
                      <Field icon={<Blocks className="h-3 w-3" />} label="Framework" value={data.framework} />
                      <Field icon={<Layers className="h-3 w-3" />} label="Architecture" value={data.architecture} />
                      <div className="glass rounded-xl p-3.5">
                        <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <Gauge className="h-3 w-3" /> Complexity
                        </div>
                        <div className={`text-sm font-medium ${complexityColor[data.complexity] || ""}`}>{data.complexity || "—"}</div>
                      </div>
                    </div>

                    {/* two-column detail */}
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-4">
                        {data.key_technologies?.length > 0 && (
                          <Section title="Key Technologies" icon={<Cpu className="h-3.5 w-3.5" />}>
                            <div className="flex flex-wrap gap-1.5">
                              {data.key_technologies.map((t) => (
                                <span key={t} className="glass rounded-full px-2.5 py-1 text-xs text-foreground/80">{t}</span>
                              ))}
                            </div>
                          </Section>
                        )}
                        {data.modules?.length > 0 && (
                          <Section title="Detected Modules" icon={<Boxes className="h-3.5 w-3.5" />}>
                            <div className="grid grid-cols-2 gap-2">
                              {data.modules.map((m) => (
                                <div key={m} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs">
                                  <span className="h-1.5 w-1.5 rounded-full bg-brand-purple" /> {m}
                                </div>
                              ))}
                            </div>
                          </Section>
                        )}
                      </div>

                      <div className="space-y-4">
                        {data.key_files?.length > 0 && (
                          <Section title="Key Files" icon={<FileCode className="h-3.5 w-3.5" />}>
                            <div className="space-y-1">
                              {data.key_files.map((f) => (
                                <div key={f} className="truncate rounded px-2 py-1 font-mono text-xs text-foreground/70 hover:bg-white/5">{f}</div>
                              ))}
                            </div>
                          </Section>
                        )}
                        {data.security_notes?.length > 0 && (
                          <Section title="Security Observations" icon={<ShieldAlert className="h-3.5 w-3.5 text-amber-300" />}>
                            <ul className="space-y-2">
                              {data.security_notes.map((n, i) => (
                                <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                                  <span className="mt-0.5 text-amber-300">•</span> {n}
                                </li>
                              ))}
                            </ul>
                          </Section>
                        )}
                      </div>
                    </div>

                    {data.files_indexed != null && (
                      <div className="text-center text-[11px] text-muted-foreground">
                        Generated from {data.files_indexed} indexed files
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
