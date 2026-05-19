"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/modules";
import { ActionProposalCard } from "@/components/modules/actions/action-proposal-card";
import { PageHeader } from "@/components/layout/page-header";
import { useOctaneStore } from "@/lib/store/octane-store";

export default function ActionsPage() {
  const octaneActions = useOctaneStore((s) => s.octaneActions);
  const approveOctaneAction = useOctaneStore((s) => s.approveOctaneAction);
  const rejectOctaneAction = useOctaneStore((s) => s.rejectOctaneAction);

  const pending = useMemo(
    () => octaneActions.filter((a) => a.status === "proposed"),
    [octaneActions],
  );
  const history = useMemo(
    () =>
      octaneActions.filter((a) => a.status !== "proposed").slice(0, 20),
    [octaneActions],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Actions"
        description="Approve or reject proposed changes from Octane Chat. Nothing runs until you approve."
      />

      {pending.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No pending approvals"
          description='Try "add project Octane Core" or "connect github" in Ask Octane or Chat — proposals appear here.'
        />
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">
            Pending ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((action) => (
              <ActionProposalCard
                key={action.id}
                action={action}
                onApprove={approveOctaneAction}
                onReject={rejectOctaneAction}
              />
            ))}
          </div>
        </section>
      )}

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">Recent</h2>
          <div className="space-y-2">
            {history.map((action) => (
              <ActionProposalCard
                key={action.id}
                action={action}
                onApprove={approveOctaneAction}
                onReject={rejectOctaneAction}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-xs text-zinc-600">
        Ask Octane on{" "}
        <Link href="/outlook#ask-octane" className="text-amber-500 hover:underline">
          Outlook
        </Link>{" "}
        or use{" "}
        <Link href="/chat" className="text-amber-500 hover:underline">
          Chat
        </Link>{" "}
        to propose more actions.
      </p>
    </div>
  );
}
