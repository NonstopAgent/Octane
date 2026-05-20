/** Server-only env presence audit — never returns secret values. */

export type EnvKeyAudit = {
  key: string;
  configured: boolean;
  scope: "server" | "public";
  purpose: string;
};

export type EnvAuditResult = {
  checkedAt: string;
  keys: EnvKeyAudit[];
  warnings: string[];
};

const SERVER_KEYS: { key: string; purpose: string }[] = [
  { key: "GITHUB_TOKEN", purpose: "GitHub read/write for connectors and coding PRs" },
  { key: "VERCEL_TOKEN", purpose: "Vercel project and deployment status" },
  { key: "VERCEL_TEAM_ID", purpose: "Optional Vercel team scope" },
  { key: "ANTHROPIC_API_KEY", purpose: "Octane AI chat, coding edits, cron briefing" },
  { key: "NEXT_PUBLIC_APP_URL", purpose: "Absolute links in PR bodies and job docs" },
];

const PUBLIC_KEYS: { key: string; purpose: string }[] = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", purpose: "Supabase auth/sync (expected public)" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", purpose: "Supabase anon key (expected public)" },
];

function isConfigured(key: string): boolean {
  const value = process.env[key]?.trim();
  return Boolean(value);
}

export function auditServerEnv(): EnvAuditResult {
  const warnings: string[] = [];

  const keys: EnvKeyAudit[] = [
    ...SERVER_KEYS.map(({ key, purpose }) => ({
      key,
      configured: isConfigured(key),
      scope: "server" as const,
      purpose,
    })),
    ...PUBLIC_KEYS.map(({ key, purpose }) => ({
      key,
      configured: isConfigured(key),
      scope: "public" as const,
      purpose,
    })),
  ];

  const leakedServerInPublic = SERVER_KEYS.filter((k) =>
    k.key.startsWith("NEXT_PUBLIC_"),
  );
  if (leakedServerInPublic.length > 0) {
    warnings.push(
      "Server secrets must not use NEXT_PUBLIC_ prefix — they would leak to the browser.",
    );
  }

  if (isConfigured("GITHUB_TOKEN") && process.env.GITHUB_TOKEN?.includes("NEXT_PUBLIC")) {
    warnings.push("GITHUB_TOKEN must not be exposed via NEXT_PUBLIC.");
  }

  if (!isConfigured("GITHUB_TOKEN")) {
    warnings.push("GITHUB_TOKEN missing — connectors and source PR workflow will not run.");
  }
  if (!isConfigured("VERCEL_TOKEN")) {
    warnings.push("VERCEL_TOKEN missing — deployment health will be unavailable.");
  }

  return {
    checkedAt: new Date().toISOString(),
    keys,
    warnings,
  };
}
