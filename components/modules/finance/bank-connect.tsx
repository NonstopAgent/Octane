"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  Landmark,
  Loader2,
  RefreshCw,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { SectionHeader } from "@/components/modules";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/finance/metrics";
import { useOctaneStore } from "@/lib/store/octane-store";
import { usePlaidStore } from "@/lib/store/plaid-store";
import type { BankTxn } from "@/lib/store/plaid-store";
import type { TransactionType } from "@/lib/types";

type PlaidHandler = {
  create: (config: {
    token: string;
    onSuccess: (publicToken: string) => void;
    onExit?: () => void;
  }) => { open: () => void };
};

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

function loadPlaid(): Promise<PlaidHandler> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Plaid?: PlaidHandler };
    if (w.Plaid) return resolve(w.Plaid);
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PLAID_SCRIPT}"]`,
    );
    const onLoad = () => {
      if (w.Plaid) resolve(w.Plaid);
      else reject(new Error("Plaid failed to load"));
    };
    if (existing) {
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", () => reject(new Error("Plaid script error")));
      return;
    }
    const script = document.createElement("script");
    script.src = PLAID_SCRIPT;
    script.async = true;
    script.onload = onLoad;
    script.onerror = () => reject(new Error("Plaid script error"));
    document.body.appendChild(script);
  });
}

export function BankConnect() {
  const connection = usePlaidStore((s) => s.connection);
  const reviewQueue = usePlaidStore((s) => s.reviewQueue);
  const setConnection = usePlaidStore((s) => s.setConnection);
  const disconnect = usePlaidStore((s) => s.disconnect);
  const applySync = usePlaidStore((s) => s.applySync);
  const removeFromQueue = usePlaidStore((s) => s.removeFromQueue);
  const createTransaction = useOctaneStore((s) => s.createTransaction);

  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsKeys, setNeedsKeys] = useState(false);

  useEffect(() => setMounted(true), []);

  const syncTransactions = useCallback(
    async (accessToken: string, cursor?: string) => {
      const res = await fetch("/api/plaid/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, cursor }),
      });
      const data = (await res.json()) as {
        added?: BankTxn[];
        modified?: BankTxn[];
        removed?: string[];
        cursor?: string;
        needsKeys?: boolean;
        error?: string;
      };
      if (data.needsKeys) {
        setNeedsKeys(true);
        return;
      }
      if (data.error) {
        toast.error(`Bank sync: ${data.error}`);
        return;
      }
      applySync({
        added: data.added ?? [],
        modified: data.modified ?? [],
        removed: data.removed ?? [],
        cursor: data.cursor,
      });
      const count = (data.added ?? []).length;
      toast.success(
        count > 0
          ? `${count} new transaction${count === 1 ? "" : "s"} to review`
          : "Bank is up to date",
      );
    },
    [applySync],
  );

  const handleConnect = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = (await res.json()) as {
        link_token?: string;
        needsKeys?: boolean;
        error?: string;
      };
      if (data.needsKeys) {
        setNeedsKeys(true);
        return;
      }
      if (!data.link_token) {
        toast.error(data.error ?? "Could not start Plaid");
        return;
      }
      const Plaid = await loadPlaid();
      const handler = Plaid.create({
        token: data.link_token,
        onSuccess: async (publicToken: string) => {
          setBusy(true);
          try {
            const ex = await fetch("/api/plaid/exchange", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ public_token: publicToken }),
            });
            const conn = (await ex.json()) as {
              access_token?: string;
              item_id?: string;
              institution?: string;
              accounts?: {
                account_id: string;
                name: string;
                mask: string | null;
                type?: string;
                subtype?: string | null;
              }[];
              error?: string;
            };
            if (!conn.access_token) {
              toast.error(conn.error ?? "Could not link account");
              return;
            }
            setConnection({
              accessToken: conn.access_token,
              itemId: conn.item_id ?? "",
              institution: conn.institution ?? "Bank",
              accounts: conn.accounts ?? [],
              connectedAt: new Date().toISOString(),
            });
            toast.success(`Connected ${conn.institution ?? "bank"}`);
            await syncTransactions(conn.access_token);
          } finally {
            setBusy(false);
          }
        },
      });
      handler.open();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Plaid connection failed",
      );
    } finally {
      setBusy(false);
    }
  }, [setConnection, syncTransactions]);

  const tagBusiness = useCallback(
    (txn: BankTxn) => {
      const isSpend = txn.amount > 0;
      const type: TransactionType = isSpend ? "expense" : "revenue";
      const signed = isSpend ? -Math.abs(txn.amount) : Math.abs(txn.amount);
      createTransaction({
        type,
        amount: signed,
        category: txn.category,
        notes: txn.name,
        transactionDate: txn.date,
      });
      removeFromQueue(txn.id);
      toast.success(`Added to ledger: ${txn.name}`);
    },
    [createTransaction, removeFromQueue],
  );

  if (!mounted) return null;

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Bank feed (Plaid)"
        description="Connect a bank once, then tag each transaction business or personal — business ones flow straight into the ledger. No more manual entry."
      />

      {needsKeys ? (
        <Card className="border-amber-900/40 bg-amber-950/15">
          <CardContent className="space-y-2 pt-4 text-sm text-amber-100/90">
            <p className="font-medium">One-time setup: add your free Plaid keys</p>
            <ol className="ml-4 list-decimal space-y-1 text-amber-100/70">
              <li>
                Sign up at dashboard.plaid.com → Team Settings → Keys (free;
                Sandbox works instantly).
              </li>
              <li>
                Add <code className="text-amber-200">PLAID_CLIENT_ID</code>,{" "}
                <code className="text-amber-200">PLAID_SECRET</code>, and{" "}
                <code className="text-amber-200">PLAID_ENV=sandbox</code> to your
                Vercel env (and <code className="text-amber-200">.env.local</code>).
              </li>
              <li>Redeploy, then click Connect a bank.</li>
            </ol>
            <p className="text-xs text-amber-100/50">
              Sandbox uses fake test banks (login: user_good / pass_good). Real
              accounts need Plaid&apos;s Development/Production access.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!connection ? (
        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Landmark className="size-8 text-amber-400/80" />
            <div>
              <p className="text-sm font-medium text-zinc-100">
                No bank connected
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Pull transactions automatically instead of typing them in.
              </p>
            </div>
            <Button type="button" onClick={handleConnect} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Banknote className="size-4" />
              )}
              Connect a bank
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-zinc-800/80 bg-zinc-900/30">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <Landmark className="size-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-100">
                    {connection.institution}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {connection.accounts.length} account
                    {connection.accounts.length === 1 ? "" : "s"} ·{" "}
                    {connection.accounts
                      .map((a) => `${a.name}${a.mask ? ` ••${a.mask}` : ""}`)
                      .join(", ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-zinc-700"
                  disabled={busy}
                  onClick={() =>
                    void syncTransactions(
                      connection.accessToken,
                      connection.cursor,
                    ).finally(() => setBusy(false))
                  }
                >
                  <RefreshCw
                    className={busy ? "size-4 animate-spin" : "size-4"}
                  />
                  Sync
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-red-300 hover:text-red-200"
                  onClick={disconnect}
                >
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-800/80 bg-zinc-900/30">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                <p className="text-sm font-medium text-zinc-200">
                  Review ({reviewQueue.length})
                </p>
                <p className="text-[11px] text-zinc-500">
                  Tag each: business adds to the ledger, personal skips it.
                </p>
              </div>
              {reviewQueue.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">
                  Nothing to review — hit Sync to pull the latest.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-800/60">
                  {reviewQueue.slice(0, 60).map((txn) => (
                    <li
                      key={txn.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-200">
                          {txn.name}
                          {txn.pending ? (
                            <span className="ml-1.5 text-[10px] text-zinc-500">
                              pending
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {txn.date}
                          {txn.category ? ` · ${txn.category}` : ""}
                        </p>
                      </div>
                      <span
                        className={
                          txn.amount > 0
                            ? "shrink-0 text-sm font-medium text-red-400"
                            : "shrink-0 text-sm font-medium text-emerald-400"
                        }
                      >
                        {txn.amount > 0 ? "-" : "+"}
                        {formatCurrency(Math.abs(txn.amount))}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          title="Business — add to ledger"
                          onClick={() => tagBusiness(txn)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-800/50 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-900/40"
                        >
                          <Building2 className="size-3" />
                          Business
                        </button>
                        <button
                          type="button"
                          title="Personal — skip"
                          onClick={() => removeFromQueue(txn.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800"
                        >
                          <User className="size-3" />
                          Personal
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
