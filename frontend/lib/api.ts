const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const V1 = `${BASE}/api/v1`;

// ---------- types ----------
export type Workspace = { id: string; name: string; type: string; created_at: string };
export type Collection = { id: string; workspace_id: string; name: string; created_at: string };
export type Doc = {
  id: string; collection_id: string; source_type: string; source_ref: string;
  status: "pending" | "indexing" | "ready" | "failed"; error: string | null;
  num_chunks: number; created_at: string;
};
export type Citation = {
  index: number; document_id: string; file_path: string | null;
  start_line: number | null; end_line: number | null; page: number | null;
  symbol_name: string | null; label: string; snippet: string;
};

// ---------- auth flag (UX gating only; real auth is the httpOnly cookie) ----------
const AUTHED = "nx_authed";
export const isAuthed = () => (typeof window !== "undefined" ? localStorage.getItem(AUTHED) === "1" : false);
export const setAuthed = () => localStorage.setItem(AUTHED, "1");
export const clearAuthed = () => localStorage.removeItem(AUTHED);

// ---------- core fetch (cookies carry the session; auto-refresh on 401) ----------
async function req<T>(path: string, opts: RequestInit = {}, retry = false): Promise<T> {
  const res = await fetch(`${V1}${path}`, { ...opts, credentials: "include" });
  if (res.status === 401 && !retry && !path.startsWith("/auth/")) {
    const r = await fetch(`${V1}/auth/refresh`, { method: "POST", credentials: "include" });
    if (r.ok) return req<T>(path, opts, true);   // one rotation + retry
    clearAuthed();
  }
  if (!res.ok) {
    if (res.status === 401) clearAuthed();
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch {}
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

function jsonReq<T>(path: string, method: string, body?: unknown): Promise<T> {
  return req<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---------- auth ----------
export async function register(email: string, password: string, name: string) {
  await jsonReq("/auth/register", "POST", { email, password, name });
  setAuthed();
}
export async function login(email: string, password: string) {
  await jsonReq("/auth/login", "POST", { email, password });
  setAuthed();
}
export async function logout() {
  try { await jsonReq("/auth/logout", "POST"); } finally { clearAuthed(); }
}
export const me = () =>
  req<{ id: string; email: string; name: string | null; email_verified: boolean }>("/auth/me");
export const verifyEmail = (token: string) => jsonReq("/auth/verify-email", "POST", { token });
export const requestPasswordReset = (email: string) =>
  jsonReq("/auth/request-password-reset", "POST", { email });
export const resetPassword = (token: string, password: string) =>
  jsonReq("/auth/reset-password", "POST", { token, password });

// ---------- workspaces / collections ----------
export const listWorkspaces = () => req<Workspace[]>("/workspaces");
export const listCollections = (wid: string) => req<Collection[]>(`/workspaces/${wid}/collections`);
export const createCollection = (wid: string, name: string) =>
  jsonReq<Collection>(`/workspaces/${wid}/collections`, "POST", { name });
export const getCollection = (id: string) => req<Collection>(`/collections/${id}`);

// ---------- documents ----------
export const listDocuments = (cid: string) => req<Doc[]>(`/collections/${cid}/documents`);
export const getDocument = (id: string) => req<Doc>(`/documents/${id}`);
export const deleteDocument = (id: string) => req<void>(`/documents/${id}`, { method: "DELETE" });

export async function addGithub(cid: string, github_url: string) {
  const fd = new FormData();
  fd.append("github_url", github_url);
  return req<Doc>(`/collections/${cid}/documents`, { method: "POST", body: fd });
}
export async function uploadFile(cid: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return req<Doc>(`/collections/${cid}/documents`, { method: "POST", body: fd });
}

// ---------- search (Ctrl+K) ----------
export type SearchResults = {
  collections: { id: string; name: string }[];
  documents: { id: string; source_ref: string; collection_id: string; source_type: string; status: string }[];
};
export const search = (q: string) => req<SearchResults>(`/search?q=${encodeURIComponent(q)}`);

// ---------- stats ----------
export type Stats = {
  collections: number; documents: number; chunks: number;
  tokens_indexed: number; questions_asked: number;
};
export const getStats = () => req<Stats>("/stats");

// ---------- source viewer ----------
export type SourceChunk = {
  ordinal: number; content: string; start_line: number | null; end_line: number | null;
  page: number | null; symbol_name: string | null; language: string | null;
};
export type SourceFile = {
  document_id: string; source_ref: string; source_type: string;
  file_path: string | null; chunks: SourceChunk[];
};
export const getSource = (documentId: string, filePath?: string | null) =>
  req<SourceFile>(`/documents/${documentId}/source${filePath ? `?file_path=${encodeURIComponent(filePath)}` : ""}`);

// ---------- file breakdown (graph + analytics) ----------
export type FileStat = { file_path: string; chunks: number; tokens: number };
export type FileBreakdown = { document_id: string; source_ref: string; files: FileStat[] };
export const getFiles = (documentId: string) => req<FileBreakdown>(`/documents/${documentId}/files`);

// ---------- chat (SSE over fetch) ----------
export type Scope = { type: "workspace" | "collection" | "document"; id: string };
export async function chatStream(
  cid: string,
  question: string,
  scope: Scope | null,
  onToken: (t: string) => void,
  onDone: (citations: Citation[], conversationId: string | null) => void,
  conversationId?: string | null
) {
  const res = await fetch(`${V1}/collections/${cid}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, scope, conversation_id: conversationId ?? null }),
  });
  if (!res.ok || !res.body) throw new Error(`Chat failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", convId: string | null = conversationId ?? null, citations: Citation[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      const ev = JSON.parse(line.slice(6));
      if (ev.type === "meta") convId = ev.conversation_id;
      else if (ev.type === "token") onToken(ev.text);
      else if (ev.type === "done") citations = ev.citations;
      else if (ev.type === "error") onToken(`\n[error: ${ev.message}]`);
    }
  }
  onDone(citations, convId);
}
