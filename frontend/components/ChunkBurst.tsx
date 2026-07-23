"use client";
import { motion } from "motion/react";
import { Database } from "lucide-react";

/** Little chunk-cubes streaming into the vector DB — shown while a doc indexes. */
export function ChunkBurst() {
  const cubes = Array.from({ length: 7 });
  return (
    <div className="relative flex h-6 items-center gap-2">
      <div className="relative h-full flex-1 overflow-hidden">
        {cubes.map((_, i) => (
          <motion.span
            key={i}
            className="absolute top-1/2 h-1.5 w-1.5 rounded-[2px] bg-brand-cyan"
            style={{ left: 0 }}
            animate={{ x: ["0%", "1200%"], opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.17, ease: "easeIn" }}
          />
        ))}
      </div>
      <motion.div
        animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
        className="shrink-0">
        <Database className="h-4 w-4 text-brand-blue" />
      </motion.div>
    </div>
  );
}
