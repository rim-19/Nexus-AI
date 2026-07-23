"use client";
import { motion } from "motion/react";

/** Cute breathing/blinking robot for empty states. */
export function RobotEmpty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-brand-blue/20 blur-2xl" />
        <svg width="96" height="104" viewBox="0 0 96 104" fill="none">
          {/* antenna */}
          <line x1="48" y1="6" x2="48" y2="18" stroke="hsl(var(--brand-cyan))" strokeWidth="2" />
          <circle cx="48" cy="5" r="4" fill="hsl(var(--brand-cyan))" />
          {/* head */}
          <rect x="20" y="18" width="56" height="44" rx="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
          {/* eyes (blink) */}
          <motion.g animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
            style={{ transformOrigin: "48px 40px" }}>
            <circle cx="38" cy="40" r="5" fill="hsl(var(--brand-cyan))" />
            <circle cx="58" cy="40" r="5" fill="hsl(var(--brand-cyan))" />
          </motion.g>
          {/* smile */}
          <path d="M40 50 Q48 55 56 50" stroke="hsl(var(--muted-foreground))" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* body */}
          <rect x="28" y="66" width="40" height="30" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
          <circle cx="48" cy="81" r="4" fill="hsl(var(--brand-blue))" />
        </svg>
      </motion.div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
