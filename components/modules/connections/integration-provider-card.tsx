"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { IntegrationAuthStatus } from "@/lib/integrations/types";
import { useOctaneStore } from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";

type IntegrationProviderCardProps = {
  provider: "github" | "vercel";
  title: string;
  description: string;
  statusPath: string;
  listPath: string;
  listLabel: string;
  connectionId: string;
};

export function IntegrationProviderCard({
  provider,
  title,
  description,
  statusPath,
  listPath,
  listLabel,
  connectionId,
}: IntegrationProviderCardProps) {
  const updateConnection = useOctaneStore((s) => s.updateConnection);
  const recordActivity = useOctaneStore((s) => s.recordActivity);

  const [status, setStatus] = useState<IntegrationAuthStatus | null>(null);
  const [listCount, setListCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [listItems, setListItems] = useState<{ id: string; label: string }[]>([]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const statusRes = await fetch(statusPath);
      if (!statusRes.ok) throw new Error("Status check failed");
      const statusJson = (await statusRes.json()) as IntegrationAuthStatus;
      setStatus(statusJson);

      if (statusJson.configured && statusJson.connected) {
        const listRes = await fetch(listPath);
        if (listRes.ok) {
          const listJson = (await listRes.json()) as {
            repos?: { fullName: string }[];
            projects?: { id: string; name: string }[];
          };
          const items =
            provider === "github"
              ? (listJson.repos ?? []).map((r) => ({
                  id: r.fullName,
                  label: r.fullName,
                }))
              : (listJson.projects ?? []).map((p) => ({
                  id: p.id,
                  label: p.name,
                }));
          setListCount(items.length);
          setListItems(items.slice(0, 8));
        }
      } else {
        setListCount(null);
        setListItems([]);
      }

      updateConnection(connectionId, {
        status: statusJson.connected
          ? "connected"
          : statusJson.configured
            ? "needs_attention"
            : "not_connected",
        lastSyncedAt: statusJson.checkedAt,
        metadata: {
          login: statusJson.login ?? "",
          configured: statusJson.configured ? "yes" : "no",
        },
      });

      recordActivity({
        action: "updated",
        entityType: "system",
        entityName: title,
        description: `Refreshed ${provider} integration status (read-only)`,
      });
    } catch {
      toast.error(`Could not refresh ${title}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    connectionId,
    listPath,
    provider,
    recordActivity,
    statusPath,
    title,
    updateConnection,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const configured = status?.configured ?? false;
  const connected = status?.connected ?? false;

  return (
    <Card className="border-zinc-800/80 bg-zinc-950/40 sm:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base text-zinc-100">{title}</CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              connected
                ? "border-emerald-800/50 text-emerald-400"
                : configured
                  ? "border-amber-800/50 text-amber-400"
                  : "border-zinc-700 text-zinc-500",
            )}
          >
            {!configured
              ? "Token missing"
              : connected
                ? "Connected"
                : "Needs attention"}
          </Badge>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-xs text-zinc-500">Checking server configuration…</p>
        ) : (
          <>
            <div className="grid gap-1 text-xs text-zinc-400">
              {status?.login ? (
                <p>
                  Account · <span className="text-zinc-300">{status.login}</span>
                </p>
              ) : null}
              {listCount !== null ? (
                <p>
                  {provider === "github" ? "Repos" : "Projects"} visible ·{" "}
                  <span className="text-zinc-300">{listCount}</span>
                </p>
              ) : null}
              {status?.checkedAt ? (
                <p className="text-zinc-600">
                  Last checked · {new Date(status.checkedAt).toLocaleString()}
                </p>
              ) : null}
              {status?.message && !connected ? (
                <p className="text-amber-400/80">{status.message}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-zinc-700"
                disabled={refreshing}
                onClick={() => void refresh()}
              >
                <RefreshCw
                  className={cn("size-3.5", refreshing && "animate-spin")}
                />
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-zinc-700"
                disabled={!connected}
                onClick={() => setListOpen((o) => !o)}
              >
                {listLabel}
              </Button>
            </div>

            {listOpen && listItems.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-2 text-xs">
                {listItems.map((item) => (
                  <li key={item.id} className="font-mono text-zinc-400">
                    {item.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
        <p className="text-[10px] text-zinc-600">
          Read-only · tokens stay on the server (
          {provider === "github" ? "GITHUB_TOKEN" : "VERCEL_TOKEN"})
        </p>
      </CardContent>
    </Card>
  );
}
