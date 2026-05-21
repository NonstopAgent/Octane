"use client";

import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OctaneAction } from "@/lib/types/octane-action";
import { cn } from "@/lib/utils";

type ActionProposalCardProps = {
  action: OctaneAction;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

export function ActionProposalCard({
  action,
  onApprove,
  onReject,
}: ActionProposalCardProps) {
  const isPending = action.status === "proposed";
  const approveLabel =
    action.type === "create_github_issue" ? "Approve Execution" : "Approve";

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        isPending
          ? "border-amber-800/40 bg-amber-950/15"
          : "border-zinc-800/80 bg-zinc-900/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-100">{action.title}</p>
          <p className="mt-1 text-sm text-zinc-400">{action.description}</p>
        </div>
        <Badge variant="outline" className="border-zinc-700 text-xs text-zinc-400">
          {action.status}
        </Badge>
      </div>
      {action.errorMessage ? (
        <p className="mt-2 text-xs text-red-400/90">{action.errorMessage}</p>
      ) : null}
      {isPending ? (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-emerald-700 hover:bg-emerald-600"
            onClick={() => onApprove(action.id)}
          >
            <Check className="size-3.5" />
            {approveLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 border-zinc-700"
            onClick={() => onReject(action.id)}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}
