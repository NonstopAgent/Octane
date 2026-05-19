import type { ProjectPriority, TaskPriority } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { badgeToneClass, type BadgeTone } from "./badge-tones";

export type Priority = ProjectPriority | TaskPriority;

const priorityTone: Record<Priority, BadgeTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
};

const priorityLabel: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export type PriorityBadgeProps = {
  priority: Priority;
  className?: string;
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const tone = priorityTone[priority];

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border font-medium",
        badgeToneClass[tone],
        priority === "critical" &&
          "border-amber-600/80 bg-amber-950/60 text-amber-200",
        className,
      )}
    >
      {priorityLabel[priority]}
    </Badge>
  );
}
