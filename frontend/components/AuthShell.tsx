"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "motion/react";
import { Background } from "@/components/Background";

const AiCore = dynamic(() => import("@/components/three/AiCore").then((m) => m.AiCore), {
  ssr: false, loading: () => null,
});

export function AuthShell({
  title, subtitle, children, footer,
}: {
  title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6">
      <Background />
      {/* faint floating orb behind the card */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-50">
        <AiCore />
      </div>

      <Link href="/" className="absolute left-6 top-5 z-20 flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded bg-brand-blue/20 text-brand-cyan">◈</span>
        Nexus <span className="text-gradient">AI</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="glass-strong relative z-10 w-full max-w-sm rounded-2xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {children}
        <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>
      </motion.div>
    </main>
  );
}
