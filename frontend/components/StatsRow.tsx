"use client";
import { useEffect, useState } from "react";
import { motion, animate } from "motion/react";
import { FileText, Boxes, MessageSquare, FolderTree } from "lucide-react";
import { getStats, type Stats } from "@/lib/api";

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

function CountUp({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)),
    });
    // safety: guarantee the final value even if rAF is throttled (unfocused tab)
    const safety = setTimeout(() => setN(value), duration * 1000 + 400);
    return () => { controls.stop(); clearTimeout(safety); };
  }, [value, duration]);
  return <>{n.toLocaleString()}</>;
}

function StatTile({ icon, label, value, delay }: {
  icon: React.ReactNode; label: string; value: number; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <span className="text-brand-cyan">{icon}</span>
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-mono text-3xl font-semibold tabular-nums"><CountUp value={value} /></div>
    </motion.div>
  );
}

function LiquidGauge({ pct }: { pct: number }) {
  const level = 100 - Math.max(4, Math.min(96, pct));
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24">
      <defs><clipPath id="lg"><circle cx="50" cy="50" r="45" /></clipPath></defs>
      <circle cx="50" cy="50" r="45" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="3" />
      <g clipPath="url(#lg)">
        <motion.path
          animate={{ x: [-50, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          d={`M0 ${level} Q 12 ${level - 4} 25 ${level} T 50 ${level} T 75 ${level} T 100 ${level} T 125 ${level} V100 H0 Z`}
          fill="hsl(var(--brand-blue))" opacity="0.55" />
        <motion.path
          animate={{ x: [0, -50] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          d={`M0 ${level + 2} Q 12 ${level - 2} 25 ${level + 2} T 50 ${level + 2} T 75 ${level + 2} T 100 ${level + 2} T 125 ${level + 2} V100 H0 Z`}
          fill="hsl(var(--brand-cyan))" opacity="0.35" />
      </g>
      <text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight="600" fill="hsl(var(--foreground))">{pct}%</text>
    </svg>
  );
}

function WaveGraph() {
  const pts = [8, 14, 10, 22, 16, 28, 20, 34, 26, 40];
  const d = "M0 40 " + pts.map((y, i) => `L ${i * 22} ${44 - y}`).join(" ");
  return (
    <svg viewBox="0 0 200 48" className="h-14 w-full" preserveAspectRatio="none">
      <motion.path d={d} fill="none" stroke="hsl(var(--brand-purple))" strokeWidth="2"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeOut" }} />
      <motion.path d={d + " L 198 48 L 0 48 Z"} fill="hsl(var(--brand-purple))" opacity="0.12"
        initial={{ opacity: 0 }} animate={{ opacity: 0.12 }} transition={{ delay: 1 }} />
    </svg>
  );
}

export function StatsRow() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { getStats().then(setS).catch(() => {}); }, []);
  if (!s) return null;
  const load = Math.min(99, Math.round((s.tokens_indexed / 500_000) * 100));

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile icon={<FolderTree className="h-4 w-4" />} label="Collections" value={s.collections} delay={0} />
      <StatTile icon={<FileText className="h-4 w-4" />} label="Documents" value={s.documents} delay={0.05} />
      <StatTile icon={<Boxes className="h-4 w-4" />} label="Chunks" value={s.chunks} delay={0.1} />
      <StatTile icon={<MessageSquare className="h-4 w-4" />} label="Questions" value={s.questions_asked} delay={0.15} />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
        className="glass col-span-2 flex items-center gap-4 rounded-2xl p-4 lg:col-span-1">
        <LiquidGauge pct={load} />
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Index load</div>
          <div className="font-mono text-sm">{s.tokens_indexed.toLocaleString()} tok</div>
          <WaveGraph />
        </div>
      </motion.div>
    </div>
  );
}
