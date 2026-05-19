"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildForecast, type MonthlySnapshot } from "@/lib/finance/forecast";
import { formatCurrency } from "@/lib/finance/metrics";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

function BarChart({
  data,
  maxValue,
  isProjection,
}: {
  data: MonthlySnapshot[];
  maxValue: number;
  isProjection?: boolean;
}) {
  if (maxValue === 0) return null;
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((m) => {
        const revH = maxValue > 0 ? (m.revenue / maxValue) * 100 : 0;
        const expH = maxValue > 0 ? (m.expenses / maxValue) * 100 : 0;
        return (
          <div key={m.monthKey} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
            <div className="w-full flex items-end gap-0.5" style={{ height: "88px" }}>
              <div
                className={cn(
                  "flex-1 rounded-sm transition-all",
                  isProjection ? "bg-emerald-600/40" : "bg-emerald-600/70",
                )}
                style={{ height: `${Math.max(revH, 2)}%` }}
              />
              <div
                className={cn(
                  "flex-1 rounded-sm transition-all",
                  isProjection ? "bg-red-600/30" : "bg-red-600/60",
                )}
                style={{ height: `${Math.max(expH, 2)}%` }}
              />
            </div>
            <p className="text-[9px] text-zinc-600 truncate w-full text-center">
              {m.month}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function RunwayGauge({ months }: { months: number | null }) {
  if (months === null) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-400">Profitable</span>
      </div>
    );
  }

  const pct = Math.min((months / 18) * 100, 100);
  const color =
    months < 3 ? "bg-red-500" : months < 6 ? "bg-amber-500" : "bg-emerald-500";
  const textColor =
    months < 3 ? "text-red-400" : months < 6 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Cash runway</span>
        <span className={cn("text-sm font-bold", textColor)}>
          {months.toFixed(1)} months
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-zinc-600">
        {months < 3
          ? "⚠️ Critical — act now"
          : months < 6
            ? "Watch burn rate closely"
            : "Healthy runway"}
      </p>
    </div>
  );
}

export function ForecastPanel({ transactions }: { transactions: Transaction[] }) {
  const forecast = useMemo(() => buildForecast(transactions), [transactions]);

  const allSnapshots = [...forecast.history, ...forecast.projection];
  const maxValue = Math.max(...allSnapshots.map((m) => Math.max(m.revenue, m.expenses)), 1);

  const netTrend = forecast.avgMonthlyRevenue - forecast.avgMonthlyBurn;

  return (
    <div className="space-y-4">
      {/* Runway + headline metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="p-4">
            <RunwayGauge months={forecast.runwayMonths} />
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-zinc-500">Avg monthly burn</p>
            <p className="text-xl font-bold text-red-400">
              {formatCurrency(forecast.avgMonthlyBurn)}
            </p>
            <p className="text-[10px] text-zinc-600">3-month average</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-zinc-500">Net trend (monthly)</p>
            <div className="flex items-center gap-1.5">
              {netTrend >= 0 ? (
                <TrendingUp className="size-4 text-emerald-400" />
              ) : (
                <TrendingDown className="size-4 text-red-400" />
              )}
              <p
                className={cn(
                  "text-xl font-bold",
                  netTrend >= 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                {netTrend >= 0 ? "+" : ""}
                {formatCurrency(netTrend)}
              </p>
            </div>
            <p className="text-[10px] text-zinc-600">Revenue minus burn</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Last 6 months — actual
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <BarChart data={forecast.history} maxValue={maxValue} />
            <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-600">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-sm bg-emerald-600/70" />
                Revenue
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-sm bg-red-600/60" />
                Expenses
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Next 6 months — projected
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <BarChart data={forecast.projection} maxValue={maxValue} isProjection />
            <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-600">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-sm bg-emerald-600/40" />
                Proj. revenue (5% MoM growth)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-sm bg-red-600/30" />
                Proj. expenses
              </span>
            </div>
            {forecast.monthsUntilBreakeven !== null && (
              <p className="mt-2 text-[10px] text-emerald-400/80">
                ✓ Projected breakeven in {forecast.monthsUntilBreakeven} months
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projection table */}
      <Card className="border-zinc-800/80 bg-zinc-900/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-300">
            6-month cash projection
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm [&_th]:border-b [&_th]:border-zinc-800 [&_th]:px-4 [&_th]:py-2 [&_th]:font-medium [&_th]:text-zinc-500 [&_th]:text-xs [&_td]:border-b [&_td]:border-zinc-800/50 [&_td]:px-4 [&_td]:py-2.5 [&_tr:last-child_td]:border-0">
            <thead>
              <tr>
                <th className="text-left">Month</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Expenses</th>
                <th className="text-right">Net</th>
                <th className="text-right">Cash</th>
              </tr>
            </thead>
            <tbody>
              {forecast.projection.map((m) => (
                <tr key={m.monthKey}>
                  <td className="text-zinc-300">{m.month}</td>
                  <td className="text-right text-emerald-400">
                    {formatCurrency(m.revenue)}
                  </td>
                  <td className="text-right text-red-400">
                    {formatCurrency(m.expenses)}
                  </td>
                  <td
                    className={cn(
                      "text-right font-medium",
                      m.net >= 0 ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {m.net >= 0 ? "+" : ""}
                    {formatCurrency(m.net)}
                  </td>
                  <td
                    className={cn(
                      "text-right font-medium",
                      m.cumulativeCash >= 0 ? "text-zinc-200" : "text-red-400",
                    )}
                  >
                    {formatCurrency(m.cumulativeCash)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {forecast.runwayDate && forecast.runwayMonths !== null && forecast.runwayMonths < 6 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-950/20 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-200">
              Cash runway alert — projected depletion in {forecast.runwayMonths.toFixed(1)} months
            </p>
            <p className="mt-1 text-xs text-amber-300/70">
              At current burn rate, cash runs out around {forecast.runwayDate}. Reduce burn, increase revenue, or raise capital.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
