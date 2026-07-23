"use client";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, FileText } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { RagPipeline } from "@/components/RagPipeline";
import { sfx } from "@/lib/sound";
import { chatStream, type Citation, type Doc, type Scope } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

export function ChatPanel({ cid, readyDocs, onOpenSource }: {
  cid: string; readyDocs: Doc[]; onOpenSource?: (c: Citation) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [scopeId, setScopeId] = useState("collection");
  const [busy, setBusy] = useState(false);
  const convRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput(""); setBusy(true); sfx.click();
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    scrollDown();

    const scope: Scope = scopeId === "collection"
      ? { type: "collection", id: cid }
      : { type: "document", id: scopeId };

    try {
      await chatStream(cid, q, scope,
        (tok) => setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + tok };
          return c;
        }),
        (citations, convId) => {
          convRef.current = convId;
          sfx.chime();
          setMessages((m) => {
            const c = [...m];
            c[c.length - 1] = { ...c[c.length - 1], citations };
            return c;
          });
          scrollDown();
        },
        convRef.current);
    } catch (e) {
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content: `⚠️ ${(e as Error).message}` };
        return c;
      });
    } finally { setBusy(false); }
  }

  return (
    <div className="flex h-full flex-col">
      {/* scope */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Search in</span>
        <select value={scopeId} onChange={(e) => setScopeId(e.target.value)}
          className="glass rounded-md px-2 py-1 text-sm outline-none">
          <option value="collection">Entire collection</option>
          {readyDocs.map((d) => <option key={d.id} value={d.id}>{d.source_ref}</option>)}
        </select>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            Ask about your sources — e.g. <span className="font-mono text-brand-cyan">"How does authentication work?"</span>
          </div>
        )}
        {messages.map((m, i) => {
          const thinking = m.role === "assistant" && m.content === "" && busy && i === messages.length - 1;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "bg-brand-blue text-white shadow-[0_0_30px_-8px_hsl(var(--brand-blue)/0.7)]"
                  : "glass"}`}>
                {thinking ? (
                  <RagPipeline />
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                )}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2.5">
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sources</div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((c) => (
                        <button key={c.index} title={c.snippet} onClick={() => onOpenSource?.(c)}
                          className="glass inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-foreground/80 transition-shadow hover:text-foreground hover:shadow-[0_0_16px_-4px_hsl(var(--brand-cyan)/0.8)]">
                          <FileText className="h-3 w-3 text-brand-cyan" /> {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* input */}
      <form onSubmit={send} className="flex gap-2 border-t border-border/60 p-3">
        <Input placeholder="Ask Nexus about your sources…" value={input}
          onChange={(e) => setInput(e.target.value)} disabled={busy} className="glass border-white/10" />
        <Button type="submit" className="glow-blue" disabled={busy}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
