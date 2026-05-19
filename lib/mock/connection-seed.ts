import type { Connection } from "@/lib/types/connection";

const T = "2026-05-01T12:00:00.000Z";

/** Placeholder integrations — OAuth wiring comes later; no secrets in client state. */
export function createDefaultConnections(): Connection[] {
  return [
    {
      id: "conn-github",
      provider: "github",
      label: "GitHub",
      status: "not_connected",
      description: "Link repos for live status on the dashboard.",
      metadata: { hint: "OAuth placeholder" },
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "conn-vercel",
      provider: "vercel",
      label: "Vercel",
      status: "not_connected",
      description: "Deployments and preview URLs per project.",
      metadata: { hint: "OAuth placeholder" },
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "conn-anthropic",
      provider: "anthropic",
      label: "Anthropic",
      status: "needs_attention",
      description: "Server-side ANTHROPIC_API_KEY — not stored in the browser.",
      metadata: { hint: "Configure in deployment env" },
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "conn-supabase",
      provider: "supabase",
      label: "Supabase",
      status: "connected",
      description: "Auth and cloud sync for your workspace.",
      metadata: { hint: "Project linked via env" },
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "conn-gmail",
      provider: "gmail",
      label: "Gmail",
      status: "coming_soon",
      description: "Inbox signals and follow-ups.",
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "conn-google-calendar",
      provider: "google_calendar",
      label: "Google Calendar",
      status: "coming_soon",
      description: "Schedule-aware Today view.",
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "conn-cursor",
      provider: "cursor",
      label: "Cursor",
      status: "coming_soon",
      description: "Agent context from your IDE — planned.",
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "conn-openai",
      provider: "openai",
      label: "OpenAI",
      status: "not_connected",
      description: "Optional alternate model provider.",
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "conn-stripe",
      provider: "stripe",
      label: "Stripe",
      status: "coming_soon",
      description: "Revenue and subscription signals.",
      createdAt: T,
      updatedAt: T,
    },
  ];
}
