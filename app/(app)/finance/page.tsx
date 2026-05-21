"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import {
  Banknote,
  Flame,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, MetricCard, SectionHeader } from "@/components/modules";
import { ForecastPanel } from "@/components/modules/finance/forecast-panel";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  capitalAllocation,
  cashAvailable,
  formatCurrency,
  formatRunway,
  monthlyBurn,
  monthlyExpenses,
  monthlyRevenue,
  netPnL,
  projectPnLTable,
  runwayMonths,
  sortTransactionsByDate,
  totalRevenue,
} from "@/lib/finance/metrics";
import { useOpenFromSearchParam } from "@/lib/hooks/use-open-from-search-param";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRANSACTION_TYPES: TransactionType[] = [
  "revenue",
  "expense",
  "investment",
  "software",
  "contractor",
  "legal",
  "other",
];

const tableClass =
  "w-full text-left text-sm [&_th]:border-b [&_th]:border-zinc-800 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-zinc-400 [&_td]:border-b [&_td]:border-zinc-800/60 [&_td]:px-3 [&_td]:py-2.5 [&_tr:last-child_td]:border-0";

export default function FinancePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <FinancePageContent />
    </Suspense>
  );
}

function FinancePageContent() {
  const transactions = useOctaneStore((state) => state.transactions);
  const projects = useOctaneStore((state) => state.projects);
  const createTransaction = useOctaneStore((state) => state.createTransaction);
  const getProjectById = useOctaneStore((state) => state.getProjectById);

  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = useCallback(() => setDialogOpen(true), []);
  useOpenFromSearchParam("new", "1", openDialog);

  const [form, setForm] = useState({
    type: "expense" as TransactionType,
    amount: "",
    category: "",
    notes: "",
    transactionDate: format(new Date(), "yyyy-MM-dd"),
    projectId: "",
  });

  const metrics = useMemo(() => {
    const cash = cashAvailable(transactions);
    const burn = monthlyBurn(transactions);
    const runway = runwayMonths(transactions);
    const pnl = netPnL(transactions);
    return {
      totalRevenue: totalRevenue(transactions),
      monthlyRevenue: monthlyRevenue(transactions),
      monthlyExpenses: monthlyExpenses(transactions),
      netPnL: pnl,
      burn,
      runway,
      cash,
    };
  }, [transactions]);

  const projectRows = useMemo(
    () => projectPnLTable(transactions, projects),
    [transactions, projects],
  );

  const allocationRows = useMemo(
    () => capitalAllocation(transactions, projects),
    [transactions, projects],
  );

  const sortedTransactions = useMemo(
    () => sortTransactionsByDate(transactions),
    [transactions],
  );

  const resetForm = () => {
    setForm({
      type: "expense",
      amount: "",
      category: "",
      notes: "",
      transactionDate: format(new Date(), "yyyy-MM-dd"),
      projectId: "",
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const rawAmount = Number.parseFloat(form.amount);
    if (Number.isNaN(rawAmount) || rawAmount === 0) return;

    const expenseTypes: TransactionType[] = [
      "expense",
      "software",
      "contractor",
      "legal",
      "other",
    ];
    const signedAmount =
      form.type === "revenue" || form.type === "investment"
        ? Math.abs(rawAmount)
        : expenseTypes.includes(form.type)
          ? -Math.abs(rawAmount)
          : rawAmount;

    createTransaction({
      type: form.type,
      amount: signedAmount,
      category: form.category || undefined,
      notes: form.notes || undefined,
      transactionDate: form.transactionDate,
      projectId: form.projectId || undefined,
    });
    toast.success("Transaction saved");
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance"
        description="Revenue, burn, runway, and transactions across Octane bets."
        actions={
          <Button type="button" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Add Transaction
          </Button>
        }
      />

      {transactions.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No transactions yet"
          description="Finance tracks revenue, burn, and runway across your bets. Add your first transaction to power the weekly review and dashboard metrics."
          action={{
            label: "Add Transaction",
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : null}

      {transactions.length > 0 ? (
      <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          icon={TrendingUp}
          subtitle="All-time recognized revenue"
        />
        <MetricCard
          title="Monthly Revenue"
          value={formatCurrency(metrics.monthlyRevenue)}
          icon={Banknote}
          subtitle="Current calendar month"
        />
        <MetricCard
          title="Monthly Expenses"
          value={formatCurrency(metrics.monthlyExpenses)}
          icon={TrendingDown}
          subtitle="Current calendar month"
        />
        <MetricCard
          title="Net P&L"
          value={formatCurrency(metrics.netPnL)}
          icon={Wallet}
          trend={{
            label: metrics.netPnL >= 0 ? "Positive month" : "Negative month",
            direction:
              metrics.netPnL > 0
                ? "up"
                : metrics.netPnL < 0
                  ? "down"
                  : "neutral",
          }}
        />
        <MetricCard
          title="Burn"
          value={formatCurrency(metrics.burn)}
          icon={Flame}
          subtitle="Monthly expense rate"
        />
        <MetricCard
          title="Runway"
          value={formatRunway(metrics.runway)}
          icon={Wallet}
          subtitle={`Cash ${formatCurrency(metrics.cash)}`}
        />
      </div>

      <Card className="border-zinc-800/80 bg-zinc-900/30">
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">Cash Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-amber-400/90">
            {formatCurrency(metrics.cash)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Computed from all transactions in the ledger (investments, revenue,
            and expenses).
          </p>
        </CardContent>
      </Card>

      {/* Financial Forecasting */}
      <section className="space-y-4">
        <SectionHeader
          title="Forecast & Runway"
          description="6-month cash projection based on current burn and revenue trajectory."
        />
        <ForecastPanel transactions={transactions} />
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Project P&L"
          description="Revenue and expenses attributed to each project."
        />
        <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-x-auto">
          <CardContent className="p-0">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Expenses</th>
                  <th className="text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr key={row.projectId}>
                    <td className="font-medium text-zinc-200">
                      {row.projectName}
                    </td>
                    <td className="text-right text-emerald-400">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="text-right text-red-400">
                      {formatCurrency(row.expenses)}
                    </td>
                    <td
                      className={cn(
                        "text-right font-medium",
                        row.net >= 0 ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {formatCurrency(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Capital Allocation"
          description="Share of project-attributed spend this period."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {allocationRows.map((row) => (
            <Card
              key={row.projectId}
              className="border-zinc-800/80 bg-zinc-900/30"
            >
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200">
                    {row.projectName}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {row.percent.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-amber-500/80 transition-all"
                    style={{ width: `${Math.min(row.percent, 100)}%` }}
                  />
                </div>
                <p className="text-sm text-zinc-500">
                  {formatCurrency(row.allocated)} allocated
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Transactions"
          description="Full ledger sorted by date."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-zinc-700"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-4" />
              Add
            </Button>
          }
        />
        <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-x-auto">
          <CardContent className="p-0">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Project</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((transaction) => {
                  const project = transaction.projectId
                    ? getProjectById(transaction.projectId)
                    : undefined;
                  return (
                    <tr key={transaction.id}>
                      <td className="text-zinc-300">
                        {transaction.transactionDate}
                      </td>
                      <td>{formatStatusLabel(transaction.type)}</td>
                      <td className="text-zinc-400">
                        {project?.name ?? "—"}
                      </td>
                      <td className="text-zinc-400">
                        {transaction.category ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "text-right font-medium",
                          transaction.amount >= 0
                            ? "text-emerald-400"
                            : "text-red-400",
                        )}
                      >
                        {formatCurrency(transaction.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
      </>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 ring-zinc-800/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Record revenue, expense, or capital movement. Amount signs are
              applied automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="txn-type">Type</Label>
              <select
                id="txn-type"
                className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    type: event.target.value as TransactionType,
                  }))
                }
              >
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatStatusLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="txn-amount">Amount (USD)</Label>
              <Input
                id="txn-amount"
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, amount: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="txn-date">Date</Label>
              <Input
                id="txn-date"
                type="date"
                required
                value={form.transactionDate}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    transactionDate: event.target.value,
                  }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="txn-project">Project (optional)</Label>
              <select
                id="txn-project"
                className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
                value={form.projectId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, projectId: event.target.value }))
                }
              >
                <option value="">None</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="txn-category">Category</Label>
              <Input
                id="txn-category"
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, category: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="txn-notes">Notes</Label>
              <Input
                id="txn-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <DialogFooter className="border-zinc-800/80 bg-zinc-900/40 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Transaction</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
