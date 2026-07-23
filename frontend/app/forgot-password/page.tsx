"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { AuthShell } from "@/components/AuthShell";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await requestPasswordReset(email); } catch {} finally { setSent(true); setBusy(false); }
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We'll send a reset link"
      footer={<Link href="/login" className="text-brand-cyan hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Input type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" className="glow-blue w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
