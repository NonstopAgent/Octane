"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GitCommit,
  GitPullRequest,
  CircleDot,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  PortfolioPulseEvent,
  PortfolioPulseResult,
} from "@/lib/integrations/portfolio-pulse";
import { cn } from "@/lib/utils";

const ANCHOR_STYLES: Record<
  PortfolioPulseEvent["anchor"],
  { badge: string; dot: string }
> = {
  Ajax: {
    badge: "border-amber-800/50 text-amber-300 bg-amber-950/20",
    dot: "bg-amber-400",
  },
  Nexus: {
    badge: "border-cyan-800/50 text-cyan-300 bg-cyan-950/20",
    dot: "bg-cyan-400",
  },
  Core: {
    badge: "border-zinc-600 text-zinc-300 bg-zinc-900/60",
    dot: "bg-zinc-400",
  },
};

function eventIcon(type: PortfolioPulseEvent["type"]) {
  if (type === "commit") return GitCommit;
  if (type === "pull_request") return GitPullRequest;
  return CircleDot;
}

export function PortfolioPulseTimeline() {
  const [pulse, setPulse] = useState<PortfolioPulseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/integrations/github/portfolio-pulse");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as PortfolioPulseResult;
      setPulse(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stream = useMemo(() => {
    if (!pulse) return [];
    return pulse.repos
      .flatMap((r) => r.events)
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )
      .slice(0, 24);
  }, [pulse]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-400">
            Cross-repo portfolio pulse
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            Ajax · Nexus · Core — commits, PRs, and issues merged by date
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-zinc-700 bg-zinc-900 text-zinc-300"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {!pulse?.configured && !loading && (
        <p className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 text-xs text-zinc-500">
          Set GITHUB_TOKEN on the server to load live portfolio activity.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400/90">Could not load portfolio pulse.</p>
      )}

      {loading && stream.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-zinc-800/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {stream.length === 0 && !loading && pulse?.configured && (
        <p className="text-xs text-zinc-500">No recent GitHub activity across portfolio repos.</p>
      )}

      <div className="relative space-y-0">
        <div
          className="absolute left-[11px] top-2 bottom-2 w-px bg-zinc-800"
          aria-hidden
        />
        {stream.map((event) => {
          const Icon = eventIcon(event.type);
          const styles = ANCHOR_STYLES[event.anchor];
          return (
            <div
              key={event.id}
              className="relative flex gap-3 py-2.5 pl-1"
            >
              <span
                className={cn(
                  "relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-zinc-950",
                  styles.dot,
                )}
              />
              <div className="min-w-0 flex-1 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant="outline" className={cn("text-[10px]", styles.badge)}>
                    {event.anchor}
                  </Badge>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                    {event.type.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-zinc-600 ml-auto">
                    {formatDistanceToNow(new Date(event.occurredAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Icon className="size-3.5 shrink-0 text-zinc-500 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 leading-snug truncate">
                      {event.title}
                    </p>
                    {event.subtitle && (
                      <p className="text-[11px] text-zinc-500 truncate">
                        {event.subtitle}
                      </p>
                    )}
                  </div>
                  {event.url && (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-zinc-600 hover:text-zinc-300"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pulse && pulse.configured && (
        <div className="mt-3 flex flex-wrap gap-2">
          {pulse.repos.map((r) => (
            <span
              key={r.anchor}
              className="rounded-md border border-zinc-800/80 bg-zinc-950/50 px-2 py-1 text-[10px] text-zinc-500"
            >
              {r.anchor}: {r.openPRs} PR{r.openPRs !== 1 ? "s" : ""} · {r.openIssues}{" "}
              issue{r.openIssues !== 1 ? "s" : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
