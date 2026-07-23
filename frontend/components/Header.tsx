"use client";
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Volume2, VolumeX, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui";
import { CommandPalette } from "@/components/CommandPalette";
import { logout } from "@/lib/api";
import { isMuted, setMuted } from "@/lib/sound";

export function Header({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const [muted, setM] = useState(false);
  useEffect(() => { setM(isMuted()); }, []);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/70 px-6 backdrop-blur-xl">
      <CommandPalette />
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded bg-brand-blue/20 text-brand-cyan">◈</span>
          Nexus <span className="text-gradient">AI</span>
        </Link>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <Link href="/analytics" className="glass hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex">
          <BarChart3 className="h-3.5 w-3.5" /> Analytics
        </Link>
        <button
          onClick={() => window.dispatchEvent(new Event("nexus:command"))}
          className="glass flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <Search className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Search</span>
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>
        <button
          onClick={() => { const nv = !muted; setMuted(nv); setM(nv); }}
          className="glass grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          title={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
        <Button variant="ghost" size="sm" onClick={async () => { await logout(); router.push("/login"); }}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
