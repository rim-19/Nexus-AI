"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Folder, Plus, FileText, Github, FileCode } from "lucide-react";
import { Header } from "@/components/Header";
import { Background } from "@/components/Background";
import { RobotEmpty } from "@/components/RobotEmpty";
import { StatsRow } from "@/components/StatsRow";
import { Button, Input } from "@/components/ui";
import {
  isAuthed, listWorkspaces, listCollections, createCollection,
  type Workspace, type Collection,
} from "@/lib/api";

export default function Dashboard() {
  const router = useRouter();
  const [ws, setWs] = useState<Workspace[]>([]);
  const [active, setActive] = useState<string>("");
  const [cols, setCols] = useState<Collection[]>([]);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    listWorkspaces().then((w) => {
      setWs(w);
      if (w[0]) setActive(w[0].id);
    }).catch((e) => setErr(e.message));
  }, [router]);

  useEffect(() => {
    if (active) listCollections(active).then(setCols).catch((e) => setErr(e.message));
  }, [active]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !active) return;
    try {
      const c = await createCollection(active, newName.trim());
      setCols((p) => [...p, c]); setNewName("");
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="min-h-screen">
      <Background />
      <Header>
        {ws.length > 1 && (
          <select value={active} onChange={(e) => setActive(e.target.value)}
            className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-sm">
            {ws.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </Header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Mission Control</h1>
          <p className="text-sm text-muted-foreground">
            {ws.find((w) => w.id === active)?.name ?? "Your workspace"} — your knowledge, organized into collections.
          </p>
        </div>

        <StatsRow />

        <form onSubmit={create} className="mb-6 flex gap-2">
          <Input placeholder="New collection name (e.g. Backend Docs)" value={newName}
            onChange={(e) => setNewName(e.target.value)} className="max-w-sm" />
          <Button type="submit" variant="accent"><Plus className="h-4 w-4" /> Create</Button>
        </form>
        {err && <p className="mb-4 text-sm text-destructive">{err}</p>}

        {cols.length === 0 ? (
          <RobotEmpty title="No collections yet" subtitle="Create one above to get started" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cols.map((c, i) => (
              <motion.div key={c.id}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ y: -6 }}>
                <Link href={`/collections/${c.id}`}
                  className="glass group relative flex items-center gap-3 overflow-hidden rounded-2xl p-5 transition-shadow hover:shadow-[0_0_50px_-12px_hsl(var(--brand-blue)/0.6)]">
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-blue/10 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
                  {/* files gently float outward on hover */}
                  <div className="pointer-events-none absolute right-4 top-3 flex gap-1.5">
                    {[FileText, Github, FileCode].map((Ic, k) => (
                      <Ic key={k}
                        className="h-3.5 w-3.5 translate-y-1 text-brand-cyan opacity-0 transition-all duration-300 group-hover:-translate-y-0 group-hover:opacity-70"
                        style={{ transitionDelay: `${k * 70}ms` }} />
                    ))}
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue/15 text-brand-cyan transition-transform group-hover:scale-110">
                    <Folder className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
