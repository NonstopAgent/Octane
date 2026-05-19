"use client";

import { useMemo } from "react";
import { Plug } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/modules";
import { ConnectionCard } from "@/components/modules/connections/connection-card";
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

  function handleConnect(provider: ConnectionProvider) {
    if (provider === "github") {
      proposeOctaneAction({
        type: "connect_github",
        title: "Connect GitHub",
        description: "OAuth placeholder — no API keys stored in the browser.",
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
        description: "OAuth placeholder — approve in Actions when ready.",
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
        description="Link external services. OAuth placeholders only — no passwords or API keys in local storage."
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No connections configured"
          description="Seed integrations will appear here. Connect GitHub or Vercel via proposed actions."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onConnect={() => handleConnect(connection.provider)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
