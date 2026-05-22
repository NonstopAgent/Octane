"use client";

import { ExecutionDashboard } from "@/components/engineer/ExecutionDashboard";
import { PageHeader } from "@/components/layout/page-header";

export default function EngineerPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Octane Engineer"
        description="Internal diagnostics — execution queue, typecheck runs, and audit trail from Supabase."
      />

      <ExecutionDashboard />

      <p className="text-xs text-zinc-600">
        Cron typechecks are queued via POST{" "}
        <code className="text-zinc-500">/api/engineer/cron</code> with{" "}
        <code className="text-zinc-500">x-octane-cron-secret</code>. History is
        read-only at{" "}
        <code className="text-zinc-500">/api/engineer/history</code>.
      </p>
    </div>
  );
}
