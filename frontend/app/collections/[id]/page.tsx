"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Background } from "@/components/Background";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { SourceViewer } from "@/components/SourceViewer";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { isAuthed, getCollection, type Collection, type Doc, type Citation } from "@/lib/api";

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [col, setCol] = useState<Collection | null>(null);
  const [readyDocs, setReadyDocs] = useState<Doc[]>([]);
  const [source, setSource] = useState<Citation | null>(null);
  const [showPanel, setShowPanel] = useState(false); // mobile
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    getCollection(id).then(setCol).catch((e) => setErr(e.message));
  }, [id, router]);

  const openFile = (documentId: string, file_path: string) =>
    setSource({
      index: 0, document_id: documentId, file_path, start_line: null, end_line: null,
      page: null, symbol_name: null, label: file_path, snippet: "",
    });

  return (
    <div className="flex h-screen flex-col">
      <Background />
      <Header>
        <span className="text-muted-foreground">/</span>
        <span className="truncate text-sm">{col?.name ?? "…"}</span>
      </Header>
      {err && <p className="p-4 text-sm text-destructive">{err}</p>}

      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr]">
        <aside className={`glass flex-col gap-3 overflow-hidden border-y-0 border-l-0 p-4 ${
          showPanel ? "absolute inset-0 z-20 flex bg-background/95 md:static md:bg-transparent" : "hidden"} md:flex`}>
          <div className="min-h-[220px] flex-[0_0_44%]">
            <KnowledgeGraph readyDocs={readyDocs} onOpenFile={openFile} />
          </div>
          <div className="flex-1 overflow-hidden border-t border-white/10 pt-3">
            <DocumentsPanel cid={id} onReadyDoc={setReadyDocs} />
          </div>
          <button onClick={() => setShowPanel(false)}
            className="glass rounded-lg py-2 text-xs md:hidden">Close panel</button>
        </aside>

        <section className="overflow-hidden">
          <ChatPanel cid={id} readyDocs={readyDocs} onOpenSource={setSource} />
        </section>
      </div>

      {/* mobile panel toggle */}
      <button onClick={() => setShowPanel(true)}
        className="glass-strong fixed bottom-5 left-5 z-10 grid h-11 w-11 place-items-center rounded-full md:hidden">
        <PanelLeft className="h-5 w-5" />
      </button>

      <SourceViewer citation={source} onClose={() => setSource(null)} />
    </div>
  );
}
