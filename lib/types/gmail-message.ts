/** Gmail classification bucket for Universal Signal System. */
export type GmailSignalClass = "action" | "finance" | "risk" | "opportunity";

export type GmailMessageProvenance = "live" | "mock";

export interface GmailMessage {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  provenance: GmailMessageProvenance;
  /** Set when provenance is mock — user must triage before trusting. */
  requiresTriage?: boolean;
  signalClass?: GmailSignalClass;
}

export interface GmailMessagesResponse {
  messages: GmailMessage[];
  provenance: GmailMessageProvenance;
  fetchedAt: string;
  error?: string;
}
