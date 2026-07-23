"use client";
import { motion } from "motion/react";

// Runs on every route change. Opacity-only (no transform/filter) so `fixed`
// background layers stay anchored to the viewport.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
