"use client";

import { Activity } from "lucide-react";

import type { ProjectHealth } from "@/lib/hooks/use-project-health";
import { cn } from "@/lib/utils";

const GRADE_STYLES: Record<ProjectHealth["grade"], string> = {
  healthy: "border-emerald-700/50 bg-emerald-950/40 text-emerald-400",
  watch: "border-amber-700/50 bg-amber-950/40 text-amber-400",
  attention: "border-orange-700/50 bg-orange-950/40 text-orange-400",
  critical: "border-red-700/50 bg-red-950/40 text-red-400",
};

const GRADE_LABELS: Record<ProjectHealth["grade"], string> = {
  healthy: "Healthy",
  watch: "Watch",
  attention: "Attention",
  critical: "Critical",
};

export function ProjectHealthBadge({
  health,
  className,
}: {
  health?: ProjectHealth;
  className?: string;
}) {
  if (!health) return null;

  const tooltip = health.factors
    .map((f) => `${f.label} ${f.score}/${f.max} — ${f.detail}`)
    .join("\n");

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        GRADE_STYLES[health.grade],
        className,
      )}
    >
      <Activity className="size-3" />
      {health.score}
      <span className="opacity-80">· {GRADE_LABELS[health.grade]}</span>
    </span>
  );
}
