import {
  endOfMonth,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";

import type { Project, Transaction } from "@/lib/types";

const EXPENSE_TYPES: Transaction["type"][] = [
  "expense",
  "software",
  "contractor",
  "legal",
  "other",
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isExpenseTransaction(transaction: Transaction): boolean {
  return (
    EXPENSE_TYPES.includes(transaction.type) || transaction.amount < 0
  );
}

export function isRevenueTransaction(transaction: Transaction): boolean {
  return transaction.type === "revenue";
}

export function cashAvailable(transactions: Transaction[]): number {
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function totalRevenue(transactions: Transaction[]): number {
  return transactions
    .filter(isRevenueTransaction)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
}

export function getTransactionsInMonth(
  transactions: Transaction[],
  date: Date = new Date(),
): Transaction[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return transactions.filter((transaction) => {
    const txnDate = parseISO(transaction.transactionDate);
    return isWithinInterval(txnDate, { start, end });
  });
}

export function monthlyRevenue(
  transactions: Transaction[],
  date: Date = new Date(),
): number {
  return getTransactionsInMonth(transactions, date)
    .filter(isRevenueTransaction)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
}

export function monthlyExpenses(
  transactions: Transaction[],
  date: Date = new Date(),
): number {
  return getTransactionsInMonth(transactions, date)
    .filter(isExpenseTransaction)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
}

export function netPnL(
  transactions: Transaction[],
  date: Date = new Date(),
): number {
  return monthlyRevenue(transactions, date) - monthlyExpenses(transactions, date);
}

export function monthlyBurn(
  transactions: Transaction[],
  date: Date = new Date(),
): number {
  return monthlyExpenses(transactions, date);
}

/** Sum of expense outflows in the trailing N calendar days (inclusive of reference day). */
export function expensesInLastNDays(
  transactions: Transaction[],
  days: number,
  projectId?: string,
  referenceDate: Date = new Date(),
): number {
  const end = startOfDay(referenceDate);
  const start = subDays(end, days);
  return transactions
    .filter((transaction) => {
      if (!isExpenseTransaction(transaction)) return false;
      if (projectId && transaction.projectId !== projectId) return false;
      const txnDate = startOfDay(parseISO(transaction.transactionDate));
      return isWithinInterval(txnDate, { start, end });
    })
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
}

/** Trailing 30-day expense total used as projected monthly burn for anomaly checks. */
export function projectedMonthlyBurnFromLast30Days(
  transactions: Transaction[],
  projectId?: string,
  referenceDate: Date = new Date(),
): number {
  return expensesInLastNDays(transactions, 30, projectId, referenceDate);
}

export function runwayMonths(transactions: Transaction[]): number | null {
  const cash = cashAvailable(transactions);
  const burn = monthlyBurn(transactions);
  if (burn <= 0) return null;
  return cash / burn;
}

export function formatRunway(months: number | null): string {
  if (months === null) return "—";
  if (!Number.isFinite(months)) return "∞";
  return `${months.toFixed(1)} mo`;
}

export type ProjectPnLRow = {
  projectId: string;
  projectName: string;
  revenue: number;
  expenses: number;
  net: number;
};

export function projectPnLTable(
  transactions: Transaction[],
  projects: Project[],
): ProjectPnLRow[] {
  return projects.map((project) => {
    const projectTransactions = transactions.filter(
      (transaction) => transaction.projectId === project.id,
    );
    const revenue = projectTransactions
      .filter(isRevenueTransaction)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const expenses = projectTransactions
      .filter(isExpenseTransaction)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    return {
      projectId: project.id,
      projectName: project.name,
      revenue,
      expenses,
      net: revenue - expenses,
    };
  });
}

export type CapitalAllocationRow = {
  projectId: string;
  projectName: string;
  allocated: number;
  percent: number;
};

export function capitalAllocation(
  transactions: Transaction[],
  projects: Project[],
): CapitalAllocationRow[] {
  const expenseTransactions = transactions.filter(
    (transaction) => isExpenseTransaction(transaction) && transaction.projectId,
  );
  const totalAllocated = expenseTransactions.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0,
  );

  return projects.map((project) => {
    const allocated = expenseTransactions
      .filter((transaction) => transaction.projectId === project.id)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    return {
      projectId: project.id,
      projectName: project.name,
      allocated,
      percent: totalAllocated > 0 ? (allocated / totalAllocated) * 100 : 0,
    };
  });
}

export function sortTransactionsByDate(
  transactions: Transaction[],
): Transaction[] {
  return [...transactions].sort(
    (a, b) =>
      parseISO(b.transactionDate).getTime() -
      parseISO(a.transactionDate).getTime(),
  );
}
