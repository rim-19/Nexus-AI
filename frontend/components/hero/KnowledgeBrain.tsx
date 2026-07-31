"use client";
import { useMemo } from "react";
import { motion } from "motion/react";
import { Github, FileText, FileCode, Boxes } from "lucide-react";

type Node = {
  label: string;
  icon: React.ComponentType<{ className?: string }> | null;
  angle: number; // degrees
  r: number;     // % of half-size
};

const NODES: Node[] = [
  { label: "repo", icon: Github, angle: -90, r: 43 },
  { label: "auth.ts", icon: FileCode, angle: -33, r: 46 },
  { label: "README.md", icon: FileText, angle: 28, r: 43 },
  { label: "session.ts", icon: FileCode, angle: 92, r: 46 },
  { label: "vectors", icon: Boxes, angle: 152, r: 43 },
  { label: "handbook.pdf", icon: FileText, angle: 212, r: 46 },
];

const pos = (angle: number, r: number) => {
  const a = (angle * Math.PI) / 180;
  return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
};

/** Subtle animated knowledge graph — nodes wired to a glowing core with data
 *  pulses flowing inward. Pure 2D + Framer Motion (GPU transforms). */
export function KnowledgeBrain() {
  const nodes = useMemo(() => NODES.map((n) => ({ ...n, ...pos(n.angle, n.r) })), []);

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="relative aspect-square w-[min(92vw,760px)]">
        {/* ambient core glow */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--brand-blue)/0.35), transparent 70%)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* connection lines + inward data pulses */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {nodes.map((n, i) => (
            <g key={"l" + i}>
              <motion.line
                x1="50" y1="50" x2={n.x} y2={n.y}
                stroke="hsl(var(--brand-blue))" strokeWidth="0.18"
                animate={{ opacity: [0.12, 0.4, 0.12] }}
                transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
              />
              <motion.circle
                r="0.7" fill="hsl(var(--brand-cyan))"
                animate={{ cx: [n.x, 50], cy: [n.y, 50], opacity: [0, 1, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.5, ease: "easeIn" }}
              />
            </g>
          ))}
        </svg>

        {/* core node */}
        <motion.div
          className="glass-strong absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl text-brand-cyan"
          style={{ boxShadow: "0 0 50px -8px hsl(var(--brand-blue)/0.7)" }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-xl">◈</span>
        </motion.div>

        {/* satellite nodes */}
        {nodes.map((n, i) => {
          const Icon = n.icon;
          return (
            <motion.div
              key={n.label}
              className="glass absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.85, scale: 1, y: [0, -5, 0] }}
              transition={{
                opacity: { delay: 0.2 + i * 0.1, duration: 0.6 },
                scale: { delay: 0.2 + i * 0.1, duration: 0.6 },
                y: { duration: 4 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              {Icon && <Icon className="h-3 w-3 text-brand-purple" />}
              <span className="font-mono text-[10px] text-foreground/70">{n.label}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
