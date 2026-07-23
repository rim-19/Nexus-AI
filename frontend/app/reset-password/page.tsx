"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { AuthShell } from "@/components/AuthShell";
import { resetPassword } from "@/lib/api";

export default function ResetPassword() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token")); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setErr("Missing reset token"); return; }
    setErr(""); setBusy(true);
    try { await resetPassword(token, password); setDone(true); setTimeout(() => router.push("/login"), 1500); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Choose a new password"
      footer={<Link href="/login" className="text-brand-cyan hover:underline">Back to sign in</Link>}
    >
      {done ? (
        <p className="text-sm text-emerald-400">Password updated ✓ Redirecting to sign in…</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Input type="password" placeholder="New password (min 6 chars)" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" className="glow-blue w-full" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
