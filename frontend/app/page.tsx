"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Background } from "@/components/Background";
import { Magnetic } from "@/components/interactions";
import { isAuthed } from "@/lib/api";

const AiCore = dynamic(() => import("@/components/three/AiCore").then((m) => m.AiCore), {
  ssr: false,
  loading: () => null,
});

export default function Landing() {
  const router = useRouter();
  useEffect(() => { if (isAuthed()) router.replace("/dashboard"); }, [router]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Background />

      {/* nav */}
      <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-blue/20 text-brand-cyan">◈</span>
          Nexus <span className="text-gradient">AI</span>
        </div>
        <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Sign in
        </Link>
      </nav>

      {/* hero */}
      <section className="relative flex min-h-[calc(100vh-80px)] items-center justify-center">
        {/* 3D core (reacts to mouse) */}
        <div className="absolute inset-0 z-0">
          <AiCore />
        </div>

        {/* overlay content — transparent to pointer so the core stays interactive */}
        <div className="pointer-events-none relative z-10 mx-auto max-w-3xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
            className="pointer-events-auto mx-auto mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand-cyan" /> RAG, visualized — watch your AI think
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            Your Knowledge,<br /><span className="text-gradient">Alive.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
            className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Feed it GitHub repos and documents. Nexus builds a living knowledge brain and answers
            with citations to the exact file, line, and page.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="pointer-events-auto mt-9 flex items-center justify-center gap-3">
            <Magnetic>
              <Link href="/register"
                className="glow-blue inline-flex items-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-sm font-medium text-white">
                Launch Nexus <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
            <Magnetic>
              <Link href="/login"
                className="glass inline-flex items-center rounded-full px-6 py-3 text-sm font-medium transition-colors hover:bg-white/5">
                Sign in
              </Link>
            </Magnetic>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}
            className="mt-10 font-mono text-xs text-muted-foreground/70">
            hybrid search · reranking · cited answers · self-evaluating
          </motion.p>
        </div>
      </section>
    </main>
  );
}
