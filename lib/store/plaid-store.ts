"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BankAccountRef {
  account_id: string;
  name: string;
  mask: string | null;
  type?: string;
  subtype?: string | null;
}

export interface BankTxn {
  id: string;
  accountId: string;
  name: string;
  amount: number; // Plaid sign: positive = money out (spend), negative = money in
  currency: string;
  date: string;
  pending: boolean;
  category?: string;
}

export interface PlaidConnection {
  accessToken: string;
  itemId: string;
  institution: string;
  accounts: BankAccountRef[];
  cursor?: string;
  connectedAt: string;
}

interface PlaidState {
  connection: PlaidConnection | null;
  /** Synced transactions awaiting a business/personal decision. */
  reviewQueue: BankTxn[];
  setConnection: (connection: PlaidConnection) => void;
  disconnect: () => void;
  applySync: (result: {
    added: BankTxn[];
    modified: BankTxn[];
    removed: string[];
    cursor?: string;
  }) => void;
  removeFromQueue: (id: string) => void;
}

export const usePlaidStore = create<PlaidState>()(
  persist(
    (set) => ({
      connection: null,
      reviewQueue: [],
      setConnection: (connection) => set({ connection, reviewQueue: [] }),
      disconnect: () => set({ connection: null, reviewQueue: [] }),
      applySync: ({ added, modified, removed, cursor }) =>
        set((state) => {
          const removedSet = new Set(removed);
          const byId = new Map<string, BankTxn>();
          for (const t of state.reviewQueue) {
            if (!removedSet.has(t.id)) byId.set(t.id, t);
          }
          for (const t of added) byId.set(t.id, t);
          for (const t of modified) {
            if (byId.has(t.id)) byId.set(t.id, t);
          }
          const reviewQueue = [...byId.values()].sort((a, b) =>
            a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
          );
          return {
            reviewQueue,
            connection: state.connection
              ? { ...state.connection, cursor: cursor ?? state.connection.cursor }
              : state.connection,
          };
        }),
      removeFromQueue: (id) =>
        set((state) => ({
          reviewQueue: state.reviewQueue.filter((t) => t.id !== id),
        })),
    }),
    { name: "octane-plaid" },
  ),
);
