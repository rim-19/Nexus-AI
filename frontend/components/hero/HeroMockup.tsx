"use client";
import { motion } from "motion/react";
import { Github, FileText } from "lucide-react";

/** Floating glassmorphism preview of the product: chatting with a GitHub repo. */
export function HeroMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { duration: 0.9, delay: 0.5 },
        y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
      }}
      className="glass-strong relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl text-left"
      style={{ boxShadow: "0 30px 80px -30px hsl(var(--brand-blue)/0.55), 0 0 60px -20px hsl(var(--brand-purple)/0.4)" }}
    >
      {/* top glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/60 to-transparent" />

      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <div className="ml-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Github className="h-3 w-3" /> rim-19/nexus-ai
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* user */}
        <div className="flex justify-end">
          <div className="rounded-2xl bg-brand-purple px-3.5 py-2 text-[13px] text-white shadow-[0_0_24px_-8px_hsl(var(--brand-purple)/0.8)]">
            Where is authentication handled?
          </div>
        </div>

        {/* ai */}
        <div className="flex justify-start">
          <div className="glass max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed">
            Authentication is implemented in:
            <ul className="mt-1.5 space-y-1 font-mono text-[12px]">
              <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-brand-cyan" /> src/auth.ts</li>
              <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-brand-cyan" /> middleware/auth.js</li>
              <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-brand-cyan" /> services/session.ts</li>
            </ul>
            <div className="mt-3 border-t border-white/10 pt-2">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sources</div>
              <div className="flex flex-wrap gap-1.5">
                {["src/auth.ts:23-65", "README.md"].map((s) => (
                  <span key={s} className="glass inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] text-foreground/80">
                    <FileText className="h-3 w-3 text-brand-cyan" /> {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
