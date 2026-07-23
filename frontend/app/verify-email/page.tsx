"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { verifyEmail } from "@/lib/api";

export default function VerifyEmail() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setState("error"); return; }
    verifyEmail(token).then(() => setState("ok")).catch(() => setState("error"));
  }, []);

  return (
    <AuthShell
      title="Email verification"
      subtitle="Confirming your address"
      footer={<Link href="/login" className="text-brand-cyan hover:underline">Go to sign in</Link>}
    >
      {state === "loading" && <p className="text-sm text-muted-foreground">Verifying…</p>}
      {state === "ok" && <p className="text-sm text-emerald-400">Your email is verified ✓</p>}
      {state === "error" && <p className="text-sm text-destructive">This link is invalid or expired.</p>}
    </AuthShell>
  );
}
