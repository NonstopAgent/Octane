"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";

import type { EnvAuditResult } from "@/lib/integrations/env-audit";
import { cn } from "@/lib/utils";

export function EnvAuditPanel() {
  const [audit, setAudit] = useState<EnvAuditResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/env-audit");
      if (res.ok) {
        setAudit((await res.json()) as EnvAuditResult);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className="text-xs text-zinc-500">Checking server environment (no secret values)…</p>
    );
  }

  if (!audit) {
    return (
      <p className="text-xs text-amber-400/80">
        Could not load env audit — sign in and retry.
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield className="size-4 text-amber-400/80" aria-hidden />
        <h2 className="text-sm font-medium text-zinc-200">Server environment</h2>
      </div>
      <p className="mb-3 text-[11px] text-zinc-500">
        Tokens and API keys stay on the server only — never in the browser or Zustand store.
      </p>
      <ul className="space-y-1.5 text-xs">
        {audit.keys.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-zinc-800/60 px-2 py-1.5"
          >
            <span className="font-mono text-zinc-400">{row.key}</span>
            <span
              className={cn(
                row.configured ? "text-emerald-400" : "text-amber-400/90",
              )}
            >
              {row.configured ? "configured" : "missing"}
              {row.scope === "public" ? " · public" : " · server-only"}
            </span>
          </li>
        ))}
      </ul>
      {audit.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[11px] text-amber-400/80">
          {audit.warnings.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
