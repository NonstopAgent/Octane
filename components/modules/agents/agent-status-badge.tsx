import { Activity, AlertCircle, Bot, Pause, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/lib/types";

type Props = {
  status: AgentStatus;
  className?: string;
};

const config: Record<
  AgentStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  offline: {
    label: "Offline",
    icon: WifiOff,
    className:
      "border-zinc-700 bg-zinc-900 text-zinc-400",
  },
  idle: {
    label: "Idle",
    icon: Bot,
    className:
      "border-zinc-700 bg-zinc-900 text-zinc-300",
  },
  running: {
    label: "Running",
    icon: Activity,
    className:
      "border-emerald-800/60 bg-emerald-950/40 text-emerald-400",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    className:
      "border-red-800/60 bg-red-950/40 text-red-400",
  },
  paused: {
    label: "Paused",
    icon: Pause,
    className:
      "border-amber-800/60 bg-amber-950/30 text-amber-400",
  },
};

export function AgentStatusBadge({ status, className }: Props) {
  const { label, icon: Icon, className: badgeClass } = config[status];
  return (
    <Badge
      variant="outline"
      className={cn("flex items-center gap-1.5 rounded-md font-medium", badgeClass, className)}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}
