"use client";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, FileText, Volume2, Square } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { RagPipeline } from "@/components/RagPipeline";
import { sfx } from "@/lib/sound";
import { chatStream, type Citation, type Doc, type Scope } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[] };

function stripMarkdown(t: string) {
  return t.replace(/\[\d+\]/g, "").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
}

/** Renders an assistant answer: markdown formatting + [n] as clickable citation chips. */
function Answer({ content, citations, onOpenSource }: {
  content: string; citations?: Citation[]; onOpenSource?: (c: Citation) => void;
}) {
  // turn bare [n] into a link react-markdown can render as a clickable superscript
  const prepared = content.replace(/\[(\d+)\]/g, "[$1](nexus-cite:$1)");
  return (
    <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (p) => <p className="my-2" {...p} />,
          ul: (p) => <ul className="my-2 ml-4 list-disc space-y-1" {...p} />,
          ol: (p) => <ol className="my-2 ml-4 list-decimal space-y-1" {...p} />,
          li: (p) => <li className="marker:text-brand-cyan" {...p} />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          h1: (p) => <h1 className="mb-2 mt-3 text-base font-semibold" {...p} />,
          h2: (p) => <h2 className="mb-2 mt-3 text-sm font-semibold" {...p} />,
          h3: (p) => <h3 className="mb-1 mt-2 text-sm font-semibold" {...p} />,
          code: (p) => <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.8em]" {...p} />,
          pre: (p) => <pre className="my-2 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs" {...p} />,
          a: ({ href, children, ...rest }) => {
            if (href?.startsWith("nexus-cite:")) {
              const idx = parseInt(href.split(":")[1], 10);
              const c = citations?.find((x) => x.index === idx);
              return (
                <button
                  onClick={() => c && onOpenSource?.(c)}
                  title={c?.label}
                  className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-brand-purple/25 px-1 align-super text-[10px] font-medium text-brand-purple transition-colors hover:bg-brand-purple/40">
                  {idx}
                </button>
              );
            }
            return <a href={href} target="_blank" rel="noreferrer" className="text-brand-cyan underline" {...rest}>{children}</a>;
          },
        }}>
        {prepared}
      </Markdown>
    </div>
  );
}

export function ChatPanel({ cid, readyDocs, onOpenSource }: {
  cid: string; readyDocs: Doc[]; onOpenSource?: (c: Citation) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [scopeId, setScopeId] = useState("collection");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const convRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollDown = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

  function speak(i: number, text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (speaking === i) { setSpeaking(null); return; }
    const u = new SpeechSynthesisUtterance(stripMarkdown(text));
    u.rate = 1.02;
    u.onend = () => setSpeaking(null);
    setSpeaking(i);
    window.speechSynthesis.speak(u);
  }

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
          convRef.current = convId; sfx.chime();
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
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Search in</span>
        <select value={scopeId} onChange={(e) => setScopeId(e.target.value)}
          className="glass rounded-md px-2 py-1 text-sm outline-none">
          <option value="collection">Entire collection</option>
          {readyDocs.map((d) => <option key={d.id} value={d.id}>{d.source_ref}</option>)}
        </select>
      </div>

      <div data-lenis-prevent className="flex-1 space-y-5 overflow-y-auto p-5">
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
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-brand-purple text-white shadow-[0_0_30px_-8px_hsl(var(--brand-purple)/0.7)]"
                  : "glass"}`}>
                {thinking ? <RagPipeline /> : (
                  m.role === "assistant"
                    ? <Answer content={m.content} citations={m.citations} onOpenSource={onOpenSource} />
                    : <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                )}

                {m.role === "assistant" && m.content && !thinking && (
                  <button onClick={() => speak(i, m.content)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-brand-cyan">
                    {speaking === i ? <Square className="h-3 w-3" /> : <Volume2 className="h-3.5 w-3.5" />}
                    {speaking === i ? "Stop" : "Read aloud"}
                  </button>
                )}

                {m.citations && m.citations.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2.5">
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sources</div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((c) => (
                        <button key={c.index} title={c.snippet} onClick={() => onOpenSource?.(c)}
                          className="glass inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-foreground/80 transition-shadow hover:text-foreground hover:shadow-[0_0_16px_-4px_hsl(var(--brand-cyan)/0.8)]">
                          <span className="text-brand-purple">{c.index}</span>
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

      <form onSubmit={send} className="flex gap-2 border-t border-border/60 p-3">
        <Input placeholder="Ask Nexus about your sources…" value={input}
          onChange={(e) => setInput(e.target.value)} disabled={busy} className="glass border-white/10" />
        <Button type="submit" className="glow-blue" disabled={busy}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
