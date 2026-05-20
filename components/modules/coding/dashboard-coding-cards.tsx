"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Code2, FileEdit, GitPullRequest } from "lucide-react";

import { useOctaneStore } from "@/lib/store/octane-store";

export function DashboardCodingCards() {
  const codingJobs = useOctaneStore((s) => s.codingJobs);

  const active = codingJobs.filter((j) =>
    ["pending_approval", "approved", "running", "pr_open"].includes(j.status),
  );
  const editsAwaiting = codingJobs.filter(
    (j) => j.editApprovalStatus === "pending" && (j.proposedEdits?.length ?? 0) > 0,
  );
  const planningPrs = codingJobs.filter(
    (j) => j.status === "pr_open" && j.prKind !== "source",
  );
  const sourcePrs = codingJobs.filter(
    (j) => j.status === "pr_open" && j.prKind === "source",
  );
  const failed = codingJobs.filter((j) => j.status === "failed");

  const suggested =
    codingJobs.find((j) => j.editApprovalStatus === "pending" && j.proposedEdits?.length) ??
    codingJobs.find((j) => j.status === "pr_open") ??
    codingJobs.find((j) => j.status === "pending_approval");

  if (codingJobs.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-400">What Octane is doing</h2>
      <DashboardGrid
        active={active.length}
        editsAwaiting={editsAwaiting.length}
        planningPrs={planningPrs.length}
        sourcePrs={sourcePrs.length}
        failed={failed.length}
      />
      {suggested ? (
        <p className="text-xs text-zinc-500">
          Suggested next:{" "}
          <Link
            href={`/coding?detail=${suggested.id}`}
            className="text-amber-400/90 hover:underline"
          >
            {suggested.title}
          </Link>
          {suggested.editApprovalStatus === "pending"
            ? " — approve proposed edits"
            : suggested.status === "pr_open" && suggested.prUrl
              ? ` — ${suggested.prKind === "source" ? "source" : "planning"} PR #${suggested.prNumber}`
              : " — approve plan or generate edits"}
        </p>
      ) : null}
    </section>
  );
}

function DashboardGrid({
  active,
  editsAwaiting,
  planningPrs,
  sourcePrs,
  failed,
}: {
  active: number;
  editsAwaiting: number;
  planningPrs: number;
  sourcePrs: number;
  failed: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <DashboardStatCard
        href="/coding"
        icon={<Code2 className="size-4 text-amber-500/80" />}
        value={active}
        label="Active jobs"
      />
      <DashboardStatCard
        href="/coding"
        icon={<FileEdit className="size-4 text-amber-400/80" />}
        value={editsAwaiting}
        label="Edits awaiting approval"
        hoverClass="hover:border-amber-900/40"
      />
      <DashboardStatCard
        href="/coding"
        icon={<GitPullRequest className="size-4 text-violet-400/80" />}
        value={planningPrs}
        label="Planning PRs to review"
        hoverClass="hover:border-violet-900/40"
      />
      <DashboardStatCard
        href="/coding"
        icon={<GitPullRequest className="size-4 text-fuchsia-400/80" />}
        value={sourcePrs}
        label="Source PRs to review"
        hoverClass="hover:border-fuchsia-900/40"
      />
      <DashboardStatCard
        href="/coding"
        value={failed}
        label="Failed jobs"
        hoverClass="hover:border-red-900/40"
      />
    </div>
  );
}

function DashboardStatCard({
  href,
  icon,
  value,
  label,
  hoverClass = "hover:border-amber-800/40",
}: {
  href: string;
  icon?: ReactNode;
  value: number;
  label: string;
  hoverClass?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 ${hoverClass}`}
    >
      <p className="flex items-center gap-2 text-lg font-bold text-zinc-100">
        {icon}
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-500">{label}</p>
    </Link>
  );
}
