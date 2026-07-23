"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { AuthShell } from "@/components/AuthShell";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(email, password); router.push("/dashboard"); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your mission control"
      footer={<>No account? <Link href="/register" className="text-brand-cyan hover:underline">Create one</Link></>}
    >
      <form onSubmit={submit} className="space-y-3">
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="glow-blue w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <div className="text-center">
          <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
