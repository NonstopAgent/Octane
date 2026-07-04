"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  FileSpreadsheet,
  Flame,
  LineChart,
  PiggyBank,
  Plus,
  Repeat,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, MetricCard, SectionHeader } from "@/components/modules";
import { BankConnect } from "@/components/modules/finance/bank-connect";
import { EquityPerformanceChart } from "@/components/modules/finance/equity-performance-chart";
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
  buildLedgerAnomalySignals,
  importFinanceCsvRows,
  parseFinanceCsv,
} from "@/lib/finance/csv-import";
import {
  capitalAllocation,
  cashAvailable,
  formatCurrency,
  formatRunway,
  monthlyBurn,
  monthlyExpenses,
  monthlyRevenue,
  netPnL,
  netPosition,
  projectPnLTable,
  recurringMonthly,
  runwayMonths,
  sortTransactionsByDate,
  subscriptionRows,
  totalExpensesAllTime,
  totalInvested,
  totalRevenue,
} from "@/lib/finance/metrics";
import {
  bookValuation,
  equityPerformanceSeries,
  summarizeFinanceHazards,
} from "@/lib/finance/valuation-engine";
import { useOpenFromSearchParam } from "@/lib/hooks/use-open-from-search-param";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { TransactionCadence, TransactionType } from "@/lib/types";
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
  const signals = useOctaneStore((state) => state.signals);
  const createTransaction = useOctaneStore((state) => state.createTransaction);
  const getProjectById = useOctaneStore((state) => state.getProjectById);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{
    added: number;
    skippedDuplicates: number;
    errors: string[];
    anomalyCount: number;
  } | null>(null);
  const upsertSignals = useOctaneStore((state) => state.upsertSignals);
  const proposeAction = useOctaneStore((state) => state.proposeAction);
  const openDialog = useCallback(() => setDialogOpen(true), []);
  useOpenFromSearchParam("new", "1", openDialog);

  const [form, setForm] = useState({
    type: "expense" as TransactionType,
    amount: "",
    category: "",
    notes: "",
    transactionDate: format(new Date(), "yyyy-MM-dd"),
    projectId: "",
    recurring: false,
    cadence: "monthly" as TransactionCadence,
  });

  const metrics = useMemo(() => {
    const cash = cashAvailable(transactions);
    const burn = monthlyBurn(transactions);
    const runway = runwayMonths(transactions);
    const pnl = netPnL(transactions);
    const book = bookValuation(projects, transactions);
    const hazards = summarizeFinanceHazards(transactions, signals);
    return {
      totalRevenue: totalRevenue(transactions),
      totalInvested: totalInvested(transactions),
      totalSpent: totalExpensesAllTime(transactions),
      netPosition: netPosition(transactions),
      recurringMonthly: recurringMonthly(transactions),
      monthlyRevenue: monthlyRevenue(transactions),
      monthlyExpenses: monthlyExpenses(transactions),
      netPnL: pnl,
      burn,
      runway,
      cash,
      bookValuation: book.bookValuation,
      hazards,
    };
  }, [transactions, projects, signals]);

  const subscriptions = useMemo(
    () => subscriptionRows(transactions),
    [transactions],
  );

  const equitySeries = useMemo(
    () => equityPerformanceSeries(transactions),
    [transactions],
  );

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
      recurring: false,
      cadence: "monthly",
    });
  };

  const handleCsvFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { rows, errors: parseErrors } = parseFinanceCsv(text);
      if (parseErrors.length > 0 && rows.length === 0) {
        setCsvPreview({
          added: 0,
          skippedDuplicates: 0,
          errors: parseErrors,
          anomalyCount: 0,
        });
        toast.error(parseErrors[0]);
        return;
      }
      const result = importFinanceCsvRows(rows, {
        projects: projects.map((p) => ({ id: p.id, name: p.name })),
        existingTransactions: transactions,
        createTransaction,
      });
      const allErrors = [...parseErrors, ...result.errors];
      setCsvPreview({
        added: result.added,
        skippedDuplicates: result.skippedDuplicates,
        errors: allErrors,
        anomalyCount: result.anomalyCount,
      });

      if (result.anomalyCount > 0) {
        const projectLinks = projects.map((p) => ({ id: p.id, name: p.name }));
        const anomalySignals = buildLedgerAnomalySignals(
          result.anomalies,
          projectLinks,
        );
        upsertSignals(anomalySignals);
        for (const signal of anomalySignals) {
          proposeAction({
            type: "create_task",
            title: signal.title,
            description: signal.summary,
            payload: { signalId: signal.id, source: "finance_csv" },
            source: "system",
            riskLevel: "high",
            projectId: signal.projectId,
          });
        }
      }

      if (result.added > 0 || result.skippedDuplicates > 0) {
        const parts: string[] = [];
        if (result.added > 0) {
          parts.push(
            `${result.added} new record${result.added !== 1 ? "s" : ""} added`,
          );
        }
        if (result.skippedDuplicates > 0) {
          parts.push(
            `${result.skippedDuplicates} duplicate${result.skippedDuplicates !== 1 ? "s" : ""} skipped`,
          );
        }
        if (result.anomalyCount > 0) {
          parts.push(
            `${result.anomalyCount} burn anomal${result.anomalyCount === 1 ? "y" : "ies"} flagged`,
          );
        }
        toast.success(`Import complete: ${parts.join(", ")}`);
      } else if (result.anomalyCount > 0) {
        toast.warning(
          `${result.anomalyCount} expense anomal${result.anomalyCount === 1 ? "y" : "ies"} flagged vs 30-day burn`,
        );
      }
      if (allErrors.length > 0) {
        toast.warning(`${allErrors.length} row(s) had errors`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
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
      recurring: form.recurring || undefined,
      cadence: form.recurring ? form.cadence : undefined,
    });
    toast.success(
      form.recurring ? "Recurring transaction saved" : "Transaction saved",
    );
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance"
        description="Revenue, burn, runway, and transactions across Octane bets."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
              <FileSpreadsheet className="size-4" />
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleCsvFile}
              />
            </label>
            <Button type="button" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Add Transaction
            </Button>
          </div>
        }
      />

      {csvPreview ? (
        <p className="text-xs text-zinc-500">
          Last CSV import: {csvPreview.added} added
          {csvPreview.skippedDuplicates > 0
            ? `, ${csvPreview.skippedDuplicates} duplicate${csvPreview.skippedDuplicates !== 1 ? "s" : ""} skipped`
            : ""}
          {csvPreview.anomalyCount > 0
            ? ` · ${csvPreview.anomalyCount} anomaly flag${csvPreview.anomalyCount !== 1 ? "s" : ""}`
            : ""}
          {csvPreview.errors.length > 0
            ? ` · ${csvPreview.errors.length} warning(s)`
            : ""}
          . Columns: date, type, project, amount, notes (+ optional recurring,
          cadence) — parsed locally only.
        </p>
      ) : null}

      <BankConnect />

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
      {metrics.hazards.hasHazard ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/25 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-200">
              Ledger hazard — burn anomaly detected
            </p>
            <p className="mt-0.5 text-xs text-red-300/80">
              {metrics.hazards.ledgerAnomalyCount > 0
                ? `${metrics.hazards.ledgerAnomalyCount} transaction${metrics.hazards.ledgerAnomalyCount !== 1 ? "s" : ""} flagged above 2.5× trailing 30-day burn. `
                : ""}
              {metrics.hazards.activeLedgerSignals > 0
                ? `${metrics.hazards.activeLedgerSignals} active finance signal${metrics.hazards.activeLedgerSignals !== 1 ? "s" : ""} from CSV import. `
                : ""}
              Review attribution in the ledger below.
            </p>
          </div>
        </div>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title="Money In / Money Out"
          description="All-time picture: what you've put in, what the business made, and what it costs to keep running."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="You've Put In"
            value={formatCurrency(metrics.totalInvested)}
            icon={PiggyBank}
            subtitle="Capital invested (all-time)"
          />
          <MetricCard
            title="Total Made"
            value={formatCurrency(metrics.totalRevenue)}
            icon={TrendingUp}
            subtitle="Revenue (all-time)"
          />
          <MetricCard
            title="Total Spent"
            value={formatCurrency(metrics.totalSpent)}
            icon={TrendingDown}
            subtitle="Expenses (all-time)"
          />
          <MetricCard
            title="Net Position"
            value={formatCurrency(metrics.netPosition)}
            icon={Wallet}
            trend={{
              label:
                metrics.netPosition >= 0
                  ? "Business is net positive"
                  : "Made less than spent",
              direction:
                metrics.netPosition > 0
                  ? "up"
                  : metrics.netPosition < 0
                    ? "down"
                    : "neutral",
            }}
          />
          <MetricCard
            title="Ongoing Monthly"
            value={formatCurrency(metrics.recurringMonthly)}
            icon={Repeat}
            subtitle={`${subscriptions.length} recurring commitment${subscriptions.length === 1 ? "" : "s"}`}
          />
        </div>

        {subscriptions.length > 0 ? (
          <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-x-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-zinc-100">
                Ongoing expenses
              </CardTitle>
              <p className="text-xs text-zinc-500">
                Latest charge per subscription, normalized to monthly (yearly ÷ 12).
                Mark a transaction as recurring to track it here.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>Commitment</th>
                    <th>Cadence</th>
                    <th>Last charged</th>
                    <th className="text-right">Monthly cost</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((row) => (
                    <tr key={row.key}>
                      <td className="font-medium text-zinc-200">{row.label}</td>
                      <td className="text-zinc-400">
                        {row.cadence === "yearly" ? "Yearly" : "Monthly"}
                      </td>
                      <td className="text-zinc-400">{row.lastCharged}</td>
                      <td className="text-right font-medium text-red-400">
                        {formatCurrency(row.monthlyAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-xs text-zinc-600">
            Tip: check “Recurring” when adding subscriptions (Vercel, Supabase,
            Anthropic API, domains…) and they’ll show up here as ongoing monthly cost.
          </p>
        )}
      </section>

      <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base text-zinc-100">
              Portfolio valuation
            </CardTitle>
            <LineChart className="size-4 text-amber-400/80" aria-hidden />
          </div>
          <p className="text-xs text-zinc-500">
            Cumulative net worth from the ledger vs 6-month cash forecast.
          </p>
        </CardHeader>
        <CardContent className="pb-4">
          <EquityPerformanceChart
            actual={equitySeries.actual}
            predicted={equitySeries.predicted}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          title="Book Valuation"
          value={formatCurrency(metrics.bookValuation)}
          icon={LineChart}
          subtitle="Annualized trailing revenue + IP appraisal"
        />
        <MetricCard
          title="Monthly Revenue"
          value={formatCurrency(metrics.monthlyRevenue)}
          icon={Banknote}
          subtitle="Current calendar month (MTD)"
        />
        <MetricCard
          title="Monthly Expenses"
          value={formatCurrency(metrics.monthlyExpenses)}
          icon={TrendingDown}
          subtitle="Current calendar month (MTD)"
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
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <label
                htmlFor="txn-recurring"
                className="flex cursor-pointer items-start gap-2.5"
              >
                <input
                  id="txn-recurring"
                  type="checkbox"
                  checked={form.recurring}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      recurring: event.target.checked,
                    }))
                  }
                  className="mt-0.5 size-4 shrink-0 rounded border-zinc-700 bg-zinc-900 accent-amber-500"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-100">
                    Recurring commitment
                  </span>
                  <span className="block text-xs text-zinc-500">
                    Subscriptions & retainers (Vercel, Supabase, Anthropic API,
                    domains…). Shows up under Ongoing Expenses as monthly cost.
                  </span>
                </span>
              </label>
              {form.recurring ? (
                <div className="mt-3 grid gap-2">
                  <Label htmlFor="txn-cadence">Billing cadence</Label>
                  <select
                    id="txn-cadence"
                    className="h-8 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
                    value={form.cadence}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        cadence: event.target.value as TransactionCadence,
                      }))
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly (normalized to ÷12)</option>
                  </select>
                </div>
              ) : null}
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
