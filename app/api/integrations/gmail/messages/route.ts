import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  getGmailProvenance,
  listUnreadGmailMessages,
} from "@/lib/integrations/gmail-client";
import { normalizeGmailSignals } from "@/lib/signals/normalize-gmail-signals";
import type { GmailMessagesResponse } from "@/lib/types/gmail-message";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const { messages, provenance, error } = await listUnreadGmailMessages();
  const signals = normalizeGmailSignals(messages);

  const body: GmailMessagesResponse & { signals: typeof signals } = {
    messages,
    signals,
    provenance: error && provenance === "mock" ? "mock" : getGmailProvenance(),
    fetchedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  };

  return NextResponse.json(body);
}
