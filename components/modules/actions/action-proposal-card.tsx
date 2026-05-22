"use client";

import { Check, MessageSquare, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OctaneAction } from "@/lib/types/octane-action";
import { isPendingOctaneAction } from "@/lib/types/octane-action";
import { useOctaneStore } from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";

type ActionProposalCardProps = {
  action: OctaneAction;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

const SOURCE_LABELS: Record<OctaneAction["source"], string> = {
  advisor: "Advisor",
  gmail: "Gmail",
  vercel: "Vercel",
  github: "GitHub",
  manual: "Manual",
  system: "System",
};

export function ActionProposalCard({
  action,
  onApprove,
  onReject,
}: ActionProposalCardProps) {
  const isPending = isPendingOctaneAction(action);
  const approveLabel =
    action.type === "create_github_issue" ? "Approve execution" : "Approve";
  const router = useRouter();
  const setPendingChatContext = useOctaneStore((s) => s.setPendingChatContext);

  function handleAskAdvisor() {
    const parts = [
      `I need strategic guidance on this proposed action:`,
      `**Action:** ${action.title}`,
      `**Description:** ${action.description}`,
      `**Source:** ${SOURCE_LABELS[action.source]}`,
    ];
    if (action.riskLevel) {
      parts.push(`**Risk level:** ${action.riskLevel}`);
    }
    parts.push(`Should I approve or reject this? What's your recommendation?`);
    setPendingChatContext(parts.join("\n"));
    router.push("/chat?context=1");
  }

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
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-zinc-700 text-xs text-zinc-400">
            {SOURCE_LABELS[action.source]}
          </Badge>
          {action.riskLevel ? (
            <Badge
              variant="outline"
              className={cn(
                "border-zinc-700 text-xs capitalize",
                action.riskLevel === "critical" && "border-red-900/60 text-red-300",
                action.riskLevel === "high" && "border-amber-900/60 text-amber-300",
              )}
            >
              {action.riskLevel}
            </Badge>
          ) : null}
          <Badge variant="outline" className="border-zinc-700 text-xs text-zinc-400">
            {action.status}
          </Badge>
        </div>
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1 text-zinc-400 hover:text-amber-400"
            onClick={handleAskAdvisor}
          >
            <MessageSquare className="size-3.5" />
            Ask Advisor
          </Button>
        </div>
      ) : null}
    </div>
  );
}
