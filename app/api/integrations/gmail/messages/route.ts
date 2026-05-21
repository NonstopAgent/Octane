import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  getGmailProvenance,
  listUnreadGmailMessages,
} from "@/lib/integrations/gmail-client";
import {
  normalizeGmailSignals,
  type GmailNormalizeContext,
} from "@/lib/signals/normalize-gmail-signals";
import type { GmailMessagesResponse } from "@/lib/types/gmail-message";

export const runtime = "nodejs";

function parseLinkContext(body: unknown): GmailNormalizeContext | undefined {
  if (!body || typeof body !== "object") return undefined;
  const raw = body as {
    projects?: { id: string; name: string }[];
    entities?: GmailNormalizeContext["entities"];
  };
  const projects = Array.isArray(raw.projects)
    ? raw.projects.filter(
        (p): p is { id: string; name: string } =>
          Boolean(p?.id && p?.name),
      )
    : undefined;
  const entities = Array.isArray(raw.entities)
    ? raw.entities.filter(
        (e): e is NonNullable<GmailNormalizeContext["entities"]>[number] =>
          Boolean(e?.id && e?.name),
      )
    : undefined;
  if (!projects?.length && !entities?.length) return undefined;
  return { projects, entities };
}

async function buildGmailResponse(
  context?: GmailNormalizeContext,
  errorNote?: string,
) {
  const { messages, provenance, error } = await listUnreadGmailMessages();
  const signals = normalizeGmailSignals(messages, context);

  const body: GmailMessagesResponse & { signals: typeof signals } = {
    messages,
    signals,
    provenance: error && provenance === "mock" ? "mock" : getGmailProvenance(),
    fetchedAt: new Date().toISOString(),
    ...(error || errorNote ? { error: error ?? errorNote } : {}),
  };

  return NextResponse.json(body);
}

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;
  return buildGmailResponse();
}

/** POST accepts project/entity lists for server-side portfolio linking (no secrets). */
export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  let context: GmailNormalizeContext | undefined;
  try {
    const body = await request.json();
    context = parseLinkContext(body);
  } catch {
    context = undefined;
  }

  return buildGmailResponse(context);
}
