"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Connection, ConnectionStatus } from "@/lib/types/connection";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  not_connected: "Not connected",
  connected: "Connected",
  needs_attention: "Needs attention",
  coming_soon: "Coming soon",
};

const STATUS_CLASS: Record<ConnectionStatus, string> = {
  not_connected: "border-zinc-700 text-zinc-400",
  connected: "border-emerald-800/50 text-emerald-400",
  needs_attention: "border-amber-800/50 text-amber-400",
  coming_soon: "border-zinc-700 text-zinc-500",
};

type ConnectionCardProps = {
  connection: Connection;
  onConnect?: () => void;
};

export function ConnectionCard({ connection, onConnect }: ConnectionCardProps) {
  const canConnect =
    connection.status === "not_connected" ||
    connection.status === "needs_attention";

  return (
    <Card className="border-zinc-800/80 bg-zinc-950/40">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base text-zinc-100">{connection.label}</CardTitle>
          <Badge
            variant="outline"
            className={cn("text-[10px]", STATUS_CLASS[connection.status])}
          >
            {STATUS_LABEL[connection.status]}
          </Badge>
        </div>
        {connection.description ? (
          <CardDescription className="text-xs">{connection.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {connection.metadata?.hint ? (
          <p className="text-[11px] text-zinc-500">{connection.metadata.hint}</p>
        ) : null}
        {canConnect ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-zinc-700"
            onClick={onConnect}
          >
            {connection.status === "needs_attention"
              ? "Review setup"
              : "Connect (OAuth soon)"}
          </Button>
        ) : connection.status === "coming_soon" ? (
          <p className="text-xs text-zinc-600">Planned integration</p>
        ) : (
          <p className="text-xs text-emerald-400/80">
            Active — no secrets stored in browser
          </p>
        )}
      </CardContent>
    </Card>
  );
}
