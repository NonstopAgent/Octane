"use client";

import { useMemo } from "react";
import { Plug } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/modules";
import { ConnectionCard } from "@/components/modules/connections/connection-card";
import { IntegrationProviderCard } from "@/components/modules/connections/integration-provider-card";
import { EnvAuditPanel } from "@/components/modules/connections/env-audit-panel";
import { ProjectLinkForm } from "@/components/modules/connections/project-link-form";
import { PageHeader } from "@/components/layout/page-header";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { ConnectionProvider } from "@/lib/types/connection";

const PROVIDER_ORDER: ConnectionProvider[] = [
  "github",
  "vercel",
  "supabase",
  "anthropic",
  "openai",
  "gmail",
  "google_calendar",
  "stripe",
  "cursor",
  "custom",
];

export default function ConnectionsPage() {
  const connections = useOctaneStore((s) => s.connections);
  const proposeOctaneAction = useOctaneStore((s) => s.proposeOctaneAction);
  const updateConnection = useOctaneStore((s) => s.updateConnection);

  const sorted = useMemo(() => {
    const order = new Map(PROVIDER_ORDER.map((p, i) => [p, i]));
    return [...connections].sort(
      (a, b) => (order.get(a.provider) ?? 99) - (order.get(b.provider) ?? 99),
    );
  }, [connections]);

  const githubConn = connections.find((c) => c.provider === "github");
  const vercelConn = connections.find((c) => c.provider === "vercel");
  const otherConnections = sorted.filter(
    (c) => c.provider !== "github" && c.provider !== "vercel",
  );

  function handleConnect(provider: ConnectionProvider) {
    if (provider === "github") {
      proposeOctaneAction({
        type: "connect_github",
        title: "Connect GitHub",
        description: "Set GITHUB_TOKEN on the server, then link repos to projects.",
        payload: {},
        source: "manual",
      });
      toast.message("GitHub connect proposed — review in Actions");
      return;
    }
    if (provider === "vercel") {
      proposeOctaneAction({
        type: "connect_vercel",
        title: "Connect Vercel",
        description: "Set VERCEL_TOKEN on the server, then link projects.",
        payload: {},
        source: "manual",
      });
      toast.message("Vercel connect proposed — review in Actions");
      return;
    }
    updateConnection(
      connections.find((c) => c.provider === provider)?.id ?? "",
      { status: "needs_attention" },
    );
    toast.info("Integration noted — complete OAuth when available.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Read-only GitHub and Vercel connectors. Tokens live in server env only — never in the browser."
      />

      <EnvAuditPanel />

      <div className="grid gap-4 sm:grid-cols-2">
        {githubConn ? (
          <IntegrationProviderCard
            provider="github"
            title="GitHub"
            description={githubConn.description ?? "Repositories and live repo stats."}
            statusPath="/api/integrations/github/status"
            listPath="/api/integrations/github/repos"
            listLabel="View repos"
            connectionId={githubConn.id}
          />
        ) : null}
        {vercelConn ? (
          <IntegrationProviderCard
            provider="vercel"
            title="Vercel"
            description={vercelConn.description ?? "Deployments and preview URLs."}
            statusPath="/api/integrations/vercel/status"
            listPath="/api/integrations/vercel/projects"
            listLabel="View projects"
            connectionId={vercelConn.id}
          />
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-400">Link to a project</h2>
        <ProjectLinkForm />
      </section>

      {otherConnections.length === 0 && !githubConn && !vercelConn ? (
        <EmptyState
          icon={Plug}
          title="No connections configured"
          description="Seed integrations will appear here. Configure GITHUB_TOKEN and VERCEL_TOKEN in deployment env."
        />
      ) : otherConnections.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {otherConnections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onConnect={() => handleConnect(connection.provider)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
