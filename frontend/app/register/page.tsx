"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { AuthShell } from "@/components/AuthShell";
import { register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await register(email, password, name); router.push("/dashboard"); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your private workspace is spun up automatically"
      footer={<>Have an account? <Link href="/login" className="text-brand-cyan hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-3">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password (min 6 chars)" value={password}
          onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="glow-blue w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
