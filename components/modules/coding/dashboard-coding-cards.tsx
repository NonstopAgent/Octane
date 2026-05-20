"use client";

import Link from "next/link";
import { Code2, GitPullRequest } from "lucide-react";

import { useOctaneStore } from "@/lib/store/octane-store";

export function DashboardCodingCards() {
  const codingJobs = useOctaneStore((s) => s.codingJobs);

  const active = codingJobs.filter((j) =>
    ["pending_approval", "approved", "running", "pr_open"].includes(j.status),
  );
  const awaitingReview = codingJobs.filter((j) => j.status === "pr_open");
  const failed = codingJobs.filter((j) => j.status === "failed");

  if (codingJobs.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-400">Coding workbench</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/coding"
          className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 hover:border-amber-800/40"
        >
          <p className="flex items-center gap-2 text-lg font-bold text-zinc-100">
            <Code2 className="size-4 text-amber-500/80" />
            {active.length}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Active coding jobs</p>
        </Link>
        <Link
          href="/coding"
          className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 hover:border-violet-900/40"
        >
          <p className="flex items-center gap-2 text-lg font-bold text-zinc-100">
            <GitPullRequest className="size-4 text-violet-400/80" />
            {awaitingReview.length}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">PRs awaiting review</p>
        </Link>
        <Link
          href="/coding"
          className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 hover:border-red-900/40"
        >
          <p className="text-lg font-bold text-zinc-100">{failed.length}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Failed jobs</p>
        </Link>
      </div>
    </section>
  );
}
