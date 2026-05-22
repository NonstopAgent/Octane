"use client";

import { useMemo } from "react";
import { parseISO } from "date-fns";

import type { ValuationChartPoint } from "@/lib/finance/valuation-engine";
import { formatCurrency } from "@/lib/finance/metrics";
import { cn } from "@/lib/utils";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 200;
const PADDING = { top: 16, right: 12, bottom: 28, left: 52 };

function buildPath(
  points: ValuationChartPoint[],
  minY: number,
  maxY: number,
  minX: number,
  maxX: number,
  plotWidth: number,
  plotHeight: number,
): string {
  if (points.length === 0) return "";
  const rangeY = maxY - minY || 1;
  const rangeX = maxX - minX || 1;

  return points
    .map((point, index) => {
      const t = parseISO(point.date).getTime();
      const x = ((t - minX) / rangeX) * plotWidth;
      const y = plotHeight - ((point.value - minY) / rangeY) * plotHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

type EquityPerformanceChartProps = {
  actual: ValuationChartPoint[];
  predicted: ValuationChartPoint[];
  className?: string;
};

export function EquityPerformanceChart({
  actual,
  predicted,
  className,
}: EquityPerformanceChartProps) {
  const { actualPath, predictedPath, minY, maxY, minX, maxX, latestActual, latestPredicted } =
    useMemo(() => {
      const all = [...actual, ...predicted];
      const values = all.map((p) => p.value);
      const times = all.map((p) => parseISO(p.date).getTime());
      const min = Math.min(...values, 0);
      const max = Math.max(...values, 1);
      const pad = (max - min) * 0.08 || 1000;
      const minY = min - pad;
      const maxY = max + pad;
      const minX = Math.min(...times);
      const maxX = Math.max(...times);
      const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
      const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

      return {
        minY,
        maxY,
        minX,
        maxX,
        actualPath: buildPath(
          actual,
          minY,
          maxY,
          minX,
          maxX,
          plotWidth,
          plotHeight,
        ),
        predictedPath: buildPath(
          predicted,
          minY,
          maxY,
          minX,
          maxX,
          plotWidth,
          plotHeight,
        ),
        latestActual: actual[actual.length - 1],
        latestPredicted: predicted[predicted.length - 1],
      };
    }, [actual, predicted]);

  if (actual.length === 0 && predicted.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">
        Add transactions to see portfolio valuation over time.
      </p>
    );
  }

  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const zeroY =
    PADDING.top +
    plotHeight -
    ((0 - minY) / (maxY - minY || 1)) * plotHeight;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500">Net worth (ledger)</p>
          <p className="text-2xl font-semibold text-zinc-50">
            {latestActual
              ? formatCurrency(latestActual.value)
              : formatCurrency(0)}
          </p>
        </div>
        {latestPredicted ? (
          <div className="text-right">
            <p className="text-xs text-zinc-500">6-mo projected</p>
            <p className="text-lg font-semibold text-amber-400/90">
              {formatCurrency(latestPredicted.value)}
            </p>
          </div>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label="Portfolio net worth: actual and projected"
      >
        <defs>
          <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = plotHeight * (1 - pct);
            const value = minY + (maxY - minY) * pct;
            return (
              <g key={pct}>
                <line
                  x1={0}
                  y1={y}
                  x2={plotWidth}
                  y2={y}
                  stroke="rgb(39 39 42)"
                  strokeWidth={1}
                />
                <text
                  x={-8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-zinc-600"
                  fontSize={9}
                >
                  {formatCurrency(value)}
                </text>
              </g>
            );
          })}

          {zeroY >= 0 && zeroY <= plotHeight ? (
            <line
              x1={0}
              y1={zeroY}
              x2={plotWidth}
              y2={zeroY}
              stroke="rgb(63 63 70)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          ) : null}

          {actualPath ? (
            <>
              <path
                d={`${actualPath} L ${plotWidth} ${plotHeight} L 0 ${plotHeight} Z`}
                fill="url(#actualFill)"
              />
              <path
                d={actualPath}
                fill="none"
                stroke="rgb(52 211 153)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}

          {predictedPath ? (
            <path
              d={predictedPath}
              fill="none"
              stroke="rgb(251 191 36)"
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
          ) : null}
        </g>
      </svg>

      <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-emerald-400" />
          Actual (cumulative ledger)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded border-t-2 border-dashed border-amber-400" />
          Predicted (6-mo forecast)
        </span>
      </div>
    </div>
  );
}
