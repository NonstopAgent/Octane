import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricTrend = {
  label: string;
  direction: "up" | "down" | "neutral";
};

export type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: MetricTrend;
  className?: string;
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: MetricCardProps) {
  const TrendIcon =
    trend?.direction === "down"
      ? TrendingDown
      : trend?.direction === "up"
        ? TrendingUp
        : null;

  return (
    <Card
      className={cn(
        "border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-sm font-medium text-zinc-300">
            {title}
          </CardTitle>
          {subtitle ? (
            <CardDescription className="text-xs text-zinc-500">
              {subtitle}
            </CardDescription>
          ) : null}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-950/60 text-amber-400/90">
          <Icon className="size-4" aria-hidden />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <p className="text-2xl font-semibold tracking-tight text-zinc-50">
          {value}
        </p>
        {trend ? (
          <p
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              trend.direction === "up" && "text-emerald-400",
              trend.direction === "down" && "text-red-400",
              trend.direction === "neutral" && "text-zinc-500",
            )}
          >
            {TrendIcon ? <TrendIcon className="size-3.5" aria-hidden /> : null}
            {trend.label}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
