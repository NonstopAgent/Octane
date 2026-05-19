"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot } from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, StatusBadge } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Agent } from "@/lib/types";

const tableClass =
  "w-full text-left text-sm [&_th]:border-b [&_th]:border-zinc-800 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-zinc-400 [&_td]:border-b [&_td]:border-zinc-800/60 [&_td]:px-3 [&_td]:py-2.5 [&_tr:last-child_td]:border-0";

export default function AgentsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <AgentsPageContent />
    </Suspense>
  );
}

function AgentsPageContent() {
  const searchParams = useSearchParams();
  const agents = useOctaneStore((state) => state.agents);
  const getProjectById = useOctaneStore((state) => state.getProjectById);
  const getTaskById = useOctaneStore((state) => state.getTaskById);

  const [selected, setSelected] = useState<Agent | null>(null);

  useEffect(() => {
    const detail = searchParams.get("detail");
    if (detail) {
      const agent = agents.find((a) => a.id === detail);
      if (agent) setSelected(agent);
    }
  }, [searchParams, agents]);

  if (agents.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Agents"
          description="AI operators assigned to projects and tasks."
        />
        <EmptyState
          icon={Bot}
          title="No agents configured"
          description="Agents automate research, ops, and build loops. Seed data includes sample agents — reset demo data in Settings if the list is empty."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agents"
        description="Read-only view of seeded AI agents. Full logs ship in a later session."
      />

      <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-x-auto">
        <CardContent className="p-0">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Project</th>
                <th>Last run</th>
                <th>Success</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const project = agent.assignedProjectId
                  ? getProjectById(agent.assignedProjectId)
                  : undefined;
                return (
                  <tr
                    key={agent.id}
                    className="cursor-pointer hover:bg-zinc-800/30"
                    onClick={() => setSelected(agent)}
                  >
                    <td className="font-medium text-zinc-200">{agent.name}</td>
                    <td>
                      <StatusBadge domain="agent" status={agent.status} />
                    </td>
                    <td className="text-zinc-400">{project?.name ?? "—"}</td>
                    <td className="text-zinc-400">
                      {agent.lastRunAt
                        ? format(new Date(agent.lastRunAt), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="text-zinc-400">
                      {agent.successRate != null
                        ? `${Math.round(agent.successRate * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent
          side="right"
          className="w-full border-zinc-800 bg-zinc-950 sm:max-w-md"
        >
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-zinc-50">{selected.name}</SheetTitle>
                <SheetDescription className="text-zinc-400">
                  {selected.purpose}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4 pt-0 text-sm">
                <StatusBadge domain="agent" status={selected.status} />
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">
                    Mission
                  </p>
                  <p className="mt-1 text-zinc-300">{selected.purpose}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">
                    Project
                  </p>
                  <p className="mt-1 text-zinc-200">
                    {selected.assignedProjectId
                      ? getProjectById(selected.assignedProjectId)?.name
                      : "Unassigned"}
                  </p>
                </div>
                {selected.currentTask ? (
                  <div>
                    <p className="text-xs font-medium uppercase text-zinc-500">
                      Current task
                    </p>
                    <p className="mt-1 text-zinc-300">
                      {getTaskById(selected.currentTask)?.title ??
                        selected.currentTask}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">
                    Capabilities
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.capabilities.map((capability) => (
                      <Badge
                        key={capability}
                        variant="outline"
                        className="border-zinc-700 text-zinc-400"
                      >
                        {formatStatusLabel(capability)}
                      </Badge>
                    ))}
                  </div>
                </div>
                {selected.safetyLimits ? (
                  <p className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-200/90">
                    {selected.safetyLimits}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
