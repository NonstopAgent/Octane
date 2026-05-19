export type ConnectionProvider =
  | "gmail"
  | "google_calendar"
  | "github"
  | "vercel"
  | "supabase"
  | "cursor"
  | "anthropic"
  | "openai"
  | "stripe"
  | "custom";

export type ConnectionStatus =
  | "not_connected"
  | "connected"
  | "needs_attention"
  | "coming_soon";

/** Workspace-level integration — no API keys or secrets in client state. */
export interface Connection {
  id: string;
  provider: ConnectionProvider;
  label: string;
  status: ConnectionStatus;
  description?: string;
  /** Display-only metadata (repo slug, project name) — never secrets. */
  metadata?: Record<string, string>;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}
