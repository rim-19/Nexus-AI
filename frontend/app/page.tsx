"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight, ChevronDown, Sparkles, Check } from "lucide-react";
import { Background } from "@/components/Background";
import { HeroMockup } from "@/components/hero/HeroMockup";
import { Magnetic } from "@/components/interactions";
import { isAuthed } from "@/lib/api";

const AiCore = dynamic(() => import("@/components/three/AiCore").then((m) => m.AiCore), {
  ssr: false, loading: () => null,
});

const BADGES = ["Hybrid Search", "Source Citations", "GitHub", "PDFs", "Markdown", "Self-Evaluating"];

export default function Landing() {
  const router = useRouter();
  useEffect(() => { if (isAuthed()) router.replace("/dashboard"); }, [router]);

  // mouse parallax (layers move at different depths)
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const brainX = useTransform(sx, (v) => v * 22);
  const brainY = useTransform(sy, (v) => v * 22);
  const mockX = useTransform(sx, (v) => v * -12);
  const mockY = useTransform(sy, (v) => v * -12);

  function onMove(e: React.MouseEvent) {
    mx.set(e.clientX / window.innerWidth - 0.5);
    my.set(e.clientY / window.innerHeight - 0.5);
  }

  return (
    <main onMouseMove={onMove} className="relative overflow-hidden">
      <Background />

      {/* nav */}
      <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-blue/20 text-brand-cyan">◈</span>
          Nexus <span className="text-gradient">AI</span>
        </div>
        <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
      </nav>

      {/* hero */}
      <section className="relative flex min-h-[calc(100vh-80px)] flex-col items-center justify-center overflow-hidden px-6 text-center">
        {/* soft ambient radial lighting */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue/10 blur-[150px]" />
        {/* 3D AI Core focal point (parallax) */}
        <motion.div style={{ x: brainX, y: brainY }} className="pointer-events-none absolute inset-0 z-0">
          <AiCore />
        </motion.div>
        {/* keep the headline crisp over the core */}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_38%_46%_at_center,hsl(var(--background))_0%,transparent_72%)]" />

        <div className="relative z-10 flex flex-col items-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="glass mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand-cyan" /> AI Knowledge Engine
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl font-semibold leading-[1.04] tracking-tight sm:text-7xl">
            Your Knowledge,<br /><span className="text-gradient-anim">Alive.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
            className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Turn GitHub repositories and documents into a searchable AI brain — with citations to the exact file, line, and page.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-8 flex items-center justify-center gap-3">
            <Magnetic>
              <Link href="/register"
                className="group inline-flex items-center gap-2 rounded-full bg-brand-purple px-7 py-3.5 text-base font-medium text-white shadow-[0_0_44px_-6px_hsl(var(--brand-purple)/0.85)] transition-transform hover:-translate-y-0.5">
                Launch Nexus
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <Link href="/login"
              className="glass inline-flex items-center rounded-full px-5 py-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-white/5 hover:text-foreground">
              Sign in
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.45 }}
            className="mt-7 flex max-w-lg flex-wrap items-center justify-center gap-2">
            {BADGES.map((b) => (
              <span key={b} className="glass inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground">
                <Check className="h-3 w-3 text-brand-lime" /> {b}
              </span>
            ))}
          </motion.div>
        </div>

        {/* scroll cue */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1 text-muted-foreground">
          <span className="text-[10px] uppercase tracking-[0.2em]">See Nexus in action</span>
          <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </motion.div>
      </section>

      {/* product preview (below the fold, revealed on scroll) */}
      <section className="relative z-10 px-6 pb-28 pt-4">
        <motion.div style={{ x: mockX, y: mockY }}>
          <HeroMockup />
        </motion.div>
      </section>
    </main>
  );
}
