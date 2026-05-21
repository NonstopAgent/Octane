import { fetchWithTimeout } from "@/lib/integrations/http";
import type { GmailMessage, GmailMessageProvenance } from "@/lib/types/gmail-message";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

function gmailHeaders(): Record<string, string> | null {
  const token = process.env.GMAIL_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export function getGmailProvenance(): GmailMessageProvenance {
  return process.env.GMAIL_ACCESS_TOKEN?.trim() ? "live" : "mock";
}

/** Structured mock inbox when GMAIL_ACCESS_TOKEN is not configured. */
export function getMockGmailMessages(): GmailMessage[] {
  const now = new Date().toISOString();
  return [
    {
      id: "mock-gmail-1",
      from: "billing@stripe.com",
      subject: "Invoice ready — Octane Ajax subscription",
      snippet: "Your March invoice for $49.00 is available. Review charges for Octane Ajax.",
      date: now,
      unread: true,
      provenance: "mock",
      requiresTriage: true,
      signalClass: "finance",
    },
    {
      id: "mock-gmail-2",
      from: "security@github.com",
      subject: "Dependabot alert on NonstopAgent/Octane-Ajax",
      snippet: "Critical severity vulnerability detected in a dependency. Review and merge the security update.",
      date: now,
      unread: true,
      provenance: "mock",
      requiresTriage: true,
      signalClass: "risk",
    },
    {
      id: "mock-gmail-3",
      from: "partner@example.com",
      subject: "Pilot interest — Nexus research brief",
      snippet: "We would like to schedule a call about licensing your research signals product.",
      date: now,
      unread: true,
      provenance: "mock",
      requiresTriage: true,
      signalClass: "opportunity",
    },
    {
      id: "mock-gmail-4",
      from: "noreply@vercel.com",
      subject: "Action required: deployment failed for octane-nexus",
      snippet: "Production deployment failed. Open the deployment logs to diagnose the build error.",
      date: now,
      unread: true,
      provenance: "mock",
      requiresTriage: true,
      signalClass: "action",
    },
  ];
}

type GmailListItem = { id: string; threadId?: string };

type GmailMetadataHeaders = { name: string; value: string }[];

async function fetchMessageMetadata(
  messageId: string,
  headers: Record<string, string>,
): Promise<GmailMessage | null> {
  const res = await fetchWithTimeout(
    `${GMAIL_API}/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    { headers },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id: string;
    threadId?: string;
    snippet?: string;
    labelIds?: string[];
    payload?: { headers?: GmailMetadataHeaders };
  };
  const hdrs = data.payload?.headers ?? [];
  const getHeader = (name: string) =>
    hdrs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const dateRaw = getHeader("Date");
  const parsedDate = dateRaw ? new Date(dateRaw) : new Date();
  const date = Number.isNaN(parsedDate.getTime())
    ? new Date().toISOString()
    : parsedDate.toISOString();

  return {
    id: data.id,
    threadId: data.threadId,
    from: getHeader("From"),
    subject: getHeader("Subject") || "(no subject)",
    snippet: data.snippet ?? "",
    date,
    unread: (data.labelIds ?? []).includes("UNREAD"),
    provenance: "live",
  };
}

/** Read-only unread message metadata. Falls back to mock when token is missing. */
export async function listUnreadGmailMessages(): Promise<{
  messages: GmailMessage[];
  provenance: GmailMessageProvenance;
  error?: string;
}> {
  const authHeaders = gmailHeaders();
  if (!authHeaders) {
    return { messages: getMockGmailMessages(), provenance: "mock" };
  }

  try {
    const listRes = await fetchWithTimeout(
      `${GMAIL_API}/messages?q=is:unread&maxResults=15`,
      { headers: authHeaders },
    );
    if (!listRes.ok) {
      const text = await listRes.text();
      return {
        messages: getMockGmailMessages(),
        provenance: "mock",
        error: `Gmail API ${listRes.status}: ${text.slice(0, 200)}`,
      };
    }
    const listData = (await listRes.json()) as { messages?: GmailListItem[] };
    const ids = listData.messages ?? [];
    if (ids.length === 0) {
      return { messages: [], provenance: "live" };
    }

    const messages: GmailMessage[] = [];
    for (const item of ids.slice(0, 15)) {
      const meta = await fetchMessageMetadata(item.id, authHeaders);
      if (meta) messages.push(meta);
    }
    return { messages, provenance: "live" };
  } catch (err) {
    return {
      messages: getMockGmailMessages(),
      provenance: "mock",
      error: err instanceof Error ? err.message : "Gmail fetch failed",
    };
  }
}
