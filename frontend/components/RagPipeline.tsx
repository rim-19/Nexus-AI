"use client";
import { motion } from "motion/react";

// Mirrors the real backend architecture (hybrid search -> rerank -> generate).
const STAGES = [
  "Question", "Embedding", "Hybrid Search", "20 chunks",
  "Reranker", "Top 5", "Prompt", "Nexus LLM", "Answer",
];

/** Animated "watch the AI think" pipeline shown while a grounded answer is retrieved. */
export function RagPipeline() {
  return (
    <div className="flex flex-wrap items-center gap-y-2">
      {STAGES.map((s, i) => (
        <div key={s} className="flex items-center">
          <motion.span
            className="glass rounded-full px-2.5 py-1 font-mono text-[11px] leading-none text-foreground/80"
            initial={{ opacity: 0.35 }}
            animate={{
              opacity: [0.35, 1, 0.35],
              boxShadow: [
                "0 0 0px hsl(var(--brand-cyan) / 0)",
                "0 0 16px -4px hsl(var(--brand-cyan) / 0.8)",
                "0 0 0px hsl(var(--brand-cyan) / 0)",
              ],
            }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
          >
            {s}
          </motion.span>
          {i < STAGES.length - 1 && (
            <motion.span
              className="mx-1 block h-px w-4 origin-left bg-brand-cyan/40"
              animate={{ scaleX: [0.2, 1, 0.2], opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.16 + 0.08, ease: "easeInOut" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
