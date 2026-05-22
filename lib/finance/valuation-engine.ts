import {
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

import type { Project, Transaction } from "@/lib/types";
import type { Signal } from "@/lib/types/signal";

import { buildForecast } from "./forecast";
import { cashAvailable, isRevenueTransaction } from "./metrics";

/** Trailing 30-day revenue × this factor = annualized run-rate contribution. */
export const ANNUALIZATION_MULTIPLIER = 12;

export type ValuationChartPoint = {
  date: string;
  label: string;
  value: number;
  kind: "actual" | "predicted";
};

export type ProjectValuationRow = {
  projectId: string;
  projectName: string;
  trailing30Revenue: number;
  annualizedRevenue: number;
  ipAppraisalValue: number;
};

export type BookValuationResult = {
  bookValuation: number;
  annualizedRevenueTotal: number;
  ipAppraisalTotal: number;
  byProject: ProjectValuationRow[];
};

function revenueInLastNDays(
  transactions: Transaction[],
  days: number,
  projectId?: string,
  referenceDate: Date = new Date(),
): number {
  const end = startOfDay(referenceDate);
  const start = subDays(end, days);
  return transactions
    .filter((transaction) => {
      if (!isRevenueTransaction(transaction)) return false;
      if (projectId && transaction.projectId !== projectId) return false;
      const txnDate = startOfDay(parseISO(transaction.transactionDate));
      return isWithinInterval(txnDate, { start, end });
    })
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
}

/** Trailing 30-day recognized revenue for a single project. */
export function trailing30DayRevenueByProject(
  projectId: string,
  transactions: Transaction[],
  referenceDate: Date = new Date(),
): number {
  return revenueInLastNDays(transactions, 30, projectId, referenceDate);
}

export function annualizedTrailingRevenue(
  trailing30Revenue: number,
): number {
  return trailing30Revenue * ANNUALIZATION_MULTIPLIER;
}

export function bookValuation(
  projects: Project[],
  transactions: Transaction[],
  referenceDate: Date = new Date(),
): BookValuationResult {
  const byProject = projects.map((project) => {
    const trailing30Revenue = trailing30DayRevenueByProject(
      project.id,
      transactions,
      referenceDate,
    );
    const annualizedRevenue = annualizedTrailingRevenue(trailing30Revenue);
    const ipAppraisalValue = project.ipAppraisalValue ?? 0;
    return {
      projectId: project.id,
      projectName: project.name,
      trailing30Revenue,
      annualizedRevenue,
      ipAppraisalValue,
    };
  });

  const annualizedRevenueTotal = byProject.reduce(
    (sum, row) => sum + row.annualizedRevenue,
    0,
  );
  const ipAppraisalTotal = byProject.reduce(
    (sum, row) => sum + row.ipAppraisalValue,
    0,
  );

  return {
    bookValuation: annualizedRevenueTotal + ipAppraisalTotal,
    annualizedRevenueTotal,
    ipAppraisalTotal,
    byProject,
  };
}

/** Cumulative cash / net worth from the transaction ledger (all-time). */
export function netWorthSeries(transactions: Transaction[]): ValuationChartPoint[] {
  if (transactions.length === 0) return [];

  const sorted = [...transactions].sort(
    (a, b) =>
      parseISO(a.transactionDate).getTime() -
      parseISO(b.transactionDate).getTime(),
  );

  const byDate = new Map<string, number>();
  for (const transaction of sorted) {
    const key = transaction.transactionDate.slice(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + transaction.amount);
  }

  const dates = [...byDate.keys()].sort();
  let cumulative = 0;
  const points: ValuationChartPoint[] = [];

  for (const date of dates) {
    cumulative += byDate.get(date) ?? 0;
    points.push({
      date,
      label: format(parseISO(date), "MMM d, yy"),
      value: cumulative,
      kind: "actual",
    });
  }

  return points;
}

export function predictedNetWorthSeries(
  transactions: Transaction[],
): ValuationChartPoint[] {
  const forecast = buildForecast(transactions);
  const now = new Date();
  const startValue = cashAvailable(transactions);
  const points: ValuationChartPoint[] = [
    {
      date: format(now, "yyyy-MM-dd"),
      label: format(now, "MMM d"),
      value: startValue,
      kind: "predicted",
    },
  ];

  let running = startValue;
  for (const month of forecast.projection) {
    running += month.net;
    points.push({
      date: `${month.monthKey}-01`,
      label: month.month,
      value: running,
      kind: "predicted",
    });
  }

  return points;
}

export function equityPerformanceSeries(
  transactions: Transaction[],
): { actual: ValuationChartPoint[]; predicted: ValuationChartPoint[] } {
  return {
    actual: netWorthSeries(transactions),
    predicted: predictedNetWorthSeries(transactions),
  };
}

export type FinanceHazardSummary = {
  hasHazard: boolean;
  ledgerAnomalyCount: number;
  activeLedgerSignals: number;
};

/** Surfaces CSV import 2.5× burn flags and ledger anomaly signals. */
export function summarizeFinanceHazards(
  transactions: Transaction[],
  signals: Signal[] = [],
): FinanceHazardSummary {
  const ledgerAnomalyCount = transactions.filter((t) => t.anomaly).length;
  const activeLedgerSignals = signals.filter(
    (s) =>
      s.source === "finance" &&
      s.id.startsWith("sig-ledger-anomaly-") &&
      s.status !== "resolved" &&
      s.status !== "dismissed",
  ).length;

  return {
    hasHazard: ledgerAnomalyCount > 0 || activeLedgerSignals > 0,
    ledgerAnomalyCount,
    activeLedgerSignals,
  };
}

export type FinanceContextSummary = {
  bookValuation: number;
  annualizedRevenueTotal: number;
  ipAppraisalTotal: number;
  cashAvailable: number;
  netWorthLatest: number | null;
  projectedNetWorth6Mo: number | null;
  hasFinanceHazard: boolean;
};

export function buildFinanceContextSummary(
  projects: Project[],
  transactions: Transaction[],
  signals: Signal[] = [],
): FinanceContextSummary {
  const book = bookValuation(projects, transactions);
  const { actual, predicted } = equityPerformanceSeries(transactions);
  const hazards = summarizeFinanceHazards(transactions, signals);

  return {
    bookValuation: book.bookValuation,
    annualizedRevenueTotal: book.annualizedRevenueTotal,
    ipAppraisalTotal: book.ipAppraisalTotal,
    cashAvailable: cashAvailable(transactions),
    netWorthLatest: actual.length > 0 ? actual[actual.length - 1].value : null,
    projectedNetWorth6Mo:
      predicted.length > 0 ? predicted[predicted.length - 1].value : null,
    hasFinanceHazard: hazards.hasHazard,
  };
}
