import { addMonths, format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import type { Transaction } from "@/lib/types";
import { isExpenseTransaction, isRevenueTransaction } from "./metrics";

export interface MonthlySnapshot {
  month: string;        // "Jan 26"
  monthKey: string;     // "2026-01"
  revenue: number;
  expenses: number;
  net: number;
  cumulativeCash: number;
}

export interface ForecastResult {
  history: MonthlySnapshot[];       // last 6 months actual
  projection: MonthlySnapshot[];    // next 6 months projected
  runwayMonths: number | null;
  runwayDate: string | null;        // ISO date when cash runs out
  avgMonthlyBurn: number;
  avgMonthlyRevenue: number;
  monthsUntilBreakeven: number | null;
}

function getMonthlySnapshotActual(
  transactions: Transaction[],
  date: Date,
  startingCash: number,
): Omit<MonthlySnapshot, "cumulativeCash"> {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const monthTxns = transactions.filter((t) => {
    const d = parseISO(t.transactionDate);
    return isWithinInterval(d, { start, end });
  });
  const revenue = monthTxns
    .filter(isRevenueTransaction)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const expenses = monthTxns
    .filter(isExpenseTransaction)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  return {
    month: format(date, "MMM yy"),
    monthKey: format(date, "yyyy-MM"),
    revenue,
    expenses,
    net: revenue - expenses,
  };
}

export function buildForecast(transactions: Transaction[]): ForecastResult {
  const now = new Date();

  // Build 6-month history
  const historySnapshots: MonthlySnapshot[] = [];
  let runningCash = 0;

  // First pass: build history month by month
  for (let i = 5; i >= 0; i--) {
    const date = addMonths(now, -i);
    const snap = getMonthlySnapshotActual(transactions, date, runningCash);
    runningCash += snap.net;
    historySnapshots.push({ ...snap, cumulativeCash: runningCash });
  }

  // Compute averages from last 3 months
  const last3 = historySnapshots.slice(-3);
  const avgMonthlyBurn =
    last3.length > 0
      ? last3.reduce((s, m) => s + m.expenses, 0) / last3.length
      : 0;
  const avgMonthlyRevenue =
    last3.length > 0
      ? last3.reduce((s, m) => s + m.revenue, 0) / last3.length
      : 0;

  // Project 6 months forward
  const projectionSnapshots: MonthlySnapshot[] = [];
  let projectedCash = runningCash;
  let runwayMonthsVal: number | null = null;
  let runwayDate: string | null = null;
  let monthsUntilBreakeven: number | null = null;

  // Slight revenue growth assumption (5% MoM if revenue > 0)
  const revenueGrowthRate = avgMonthlyRevenue > 0 ? 1.05 : 1.0;
  let projectedRevenue = avgMonthlyRevenue;

  for (let i = 1; i <= 6; i++) {
    const date = addMonths(now, i);
    const expenses = avgMonthlyBurn;
    projectedRevenue = avgMonthlyRevenue > 0 ? projectedRevenue * revenueGrowthRate : 0;
    const net = projectedRevenue - expenses;
    projectedCash += net;

    const snap: MonthlySnapshot = {
      month: format(date, "MMM yy"),
      monthKey: format(date, "yyyy-MM"),
      revenue: projectedRevenue,
      expenses,
      net,
      cumulativeCash: projectedCash,
    };

    projectionSnapshots.push(snap);

    // Runway detection
    if (runwayDate === null && projectedCash <= 0 && avgMonthlyBurn > 0) {
      runwayMonthsVal = i;
      runwayDate = format(date, "yyyy-MM-dd");
    }

    // Breakeven detection
    if (monthsUntilBreakeven === null && projectedRevenue >= expenses) {
      monthsUntilBreakeven = i;
    }
  }

  // If cash never hits 0 in 6 months, compute linear extrapolation
  if (runwayDate === null && avgMonthlyBurn > 0) {
    const cashNow = historySnapshots[historySnapshots.length - 1]?.cumulativeCash ?? 0;
    const avgNet = avgMonthlyRevenue - avgMonthlyBurn;
    if (avgNet < 0 && cashNow > 0) {
      runwayMonthsVal = cashNow / -avgNet;
    } else if (avgNet >= 0) {
      runwayMonthsVal = null; // profitable, no runway issue
    }
  }

  return {
    history: historySnapshots,
    projection: projectionSnapshots,
    runwayMonths: runwayMonthsVal,
    runwayDate,
    avgMonthlyBurn,
    avgMonthlyRevenue,
    monthsUntilBreakeven,
  };
}
