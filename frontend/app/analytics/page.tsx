"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Zap, Boxes, Github, FileText, Activity, Clock } from "lucide-react";
import { Header } from "@/components/Header";
import { Background } from "@/components/Background";
import { StatsRow } from "@/components/StatsRow";
import { isAuthed, getAnalytics, type Analytics } from "@/lib/api";

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-blue/25 to-brand-purple/25 text-brand-cyan">{icon}</span>
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}

function AreaChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length < 2) return <p className="py-8 text-center text-sm text-muted-foreground">Ask a few questions to see activity over time.</p>;
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 100, H = 40;
  const pts = data.map((d, i) => [(i / (data.length - 1)) * W, H - (d.count / max) * (H - 6) - 3]);
  const line = "M " + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(var(--brand-purple))" stopOpacity="0.35" />
            <stop offset="1" stopColor="hsl(var(--brand-purple))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={area} fill="url(#ag)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} />
        <motion.path d={line} fill="none" stroke="hsl(var(--brand-purple))" strokeWidth="1" vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{data[0].date}</span><span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="py-6 text-sm text-muted-foreground">No data yet.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.label + i} className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 truncate font-mono text-muted-foreground">{r.label}</span>
          <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-cyan"
              initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ duration: 0.9, delay: i * 0.06, ease: "easeOut" }} />
          </div>
          <span className="w-10 text-right font-mono text-brand-cyan">{r.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    getAnalytics().then(setA).catch(() => {});
  }, [router]);

  return (
    <div className="min-h-screen">
      <Background />
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-1 text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mb-6 text-sm text-muted-foreground">Live metrics across your knowledge base.</p>

        <StatsRow />

        {a && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric icon={<Zap className="h-4 w-4" />} label="Avg latency" value={a.avg_latency_ms ? `${a.avg_latency_ms} ms` : "—"} />
              <Metric icon={<Boxes className="h-4 w-4" />} label="Embeddings" value={a.totals.embeddings.toLocaleString()} />
              <Metric icon={<Github className="h-4 w-4" />} label="Repositories" value={String(a.totals.repositories)} />
              <Metric icon={<Activity className="h-4 w-4" />} label="Storage (tokens)" value={a.totals.tokens_indexed.toLocaleString()} />
            </div>

            <div className="mb-4">
              <Panel title="Questions over time"><AreaChart data={a.questions_over_time} /></Panel>
            </div>

            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <Panel title="Most cited files">
                <Bars rows={a.most_cited_files.map((f) => ({ label: f.file.split("/").pop() || f.file, value: f.count }))} />
              </Panel>
              <Panel title="Top repositories">
                <Bars rows={a.top_repositories.map((r) => ({ label: r.source_ref, value: r.chunks }))} />
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Recent indexing jobs">
                <div className="space-y-2">
                  {a.recent_jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs yet.</p>}
                  {a.recent_jobs.map((j, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-mono text-foreground/80">{j.document}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${j.status === "done" ? "bg-brand-lime/15 text-brand-lime" : j.status === "failed" ? "bg-red-400/15 text-red-300" : "bg-amber-400/15 text-amber-300"}`}>{j.status}</span>
                        <span className="text-muted-foreground">{timeAgo(j.created_at)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Latest uploads">
                <div className="space-y-2">
                  {a.latest_uploads.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {u.source_type === "github" ? <Github className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                      <span className="flex-1 truncate font-mono text-foreground/80">{u.source_ref}</span>
                      <span className="shrink-0 text-muted-foreground">{timeAgo(u.created_at)}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
