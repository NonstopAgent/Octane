"use client";

import { PageHeader } from "@/components/layout/page-header";
import { AgentMonitorTable } from "@/components/modules/agents/agent-monitor-table";

export default function AgentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Agent Monitor"
        description="Read-only view of Octane Ajax and Nexus operators — click a row for tasks, pending actions, and activity."
      />

      <AgentMonitorTable />

      <p className="text-xs text-zinc-600">
        Monitors reflect repository push and commit signals only. To propose
        coding or ops work, use{" "}
        <a href="/coding" className="text-amber-500 hover:underline">
          Octane Engineer
        </a>{" "}
        or{" "}
        <a href="/chat" className="text-amber-500 hover:underline">
          Octane AI
        </a>
        .
      </p>
    </div>
  );
}
