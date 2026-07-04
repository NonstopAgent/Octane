"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { defaultCompanyContext } from "@/lib/company/company-context";

interface CompanyState {
  /** The company knowledge the AI reads (chat, brief, triage). Markdown. */
  context: string;
  updatedAt: string | null;
  setContext: (context: string) => void;
  resetToDefault: () => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      context: defaultCompanyContext(),
      updatedAt: null,
      setContext: (context) =>
        set({ context, updatedAt: new Date().toISOString() }),
      resetToDefault: () =>
        set({
          context: defaultCompanyContext(),
          updatedAt: new Date().toISOString(),
        }),
    }),
    { name: "octane-company-context", version: 1 },
  ),
);
