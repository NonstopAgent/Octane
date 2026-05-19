"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import { EmptyState } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { selectEntityOwnershipStats } from "@/components/settings/entity-ownership";
import { Badge } from "@/components/ui/badge";
import type { Entity } from "@/lib/types";
import type { OctanePersistedState } from "@/lib/store/octane-store";

import { HoldingsSection } from "./holdings-section";

export function EntityMapSection({ state }: { state: OctanePersistedState }) {
  const router = useRouter();
  const cards = useMemo(
    () =>
      state.entities.map((entity) => ({
        entity,
        stats: selectEntityOwnershipStats(
          entity,
          state.projects,
          state.documents,
          state.ipAssets,
        ),
      })),
    [state.documents, state.entities, state.ipAssets, state.projects],
  );

  if (state.entities.length === 0) {
    return (
      <HoldingsSection
        id="entity-map"
        title="Entity map"
        description="Legal entities, linked projects, IP, and documents."
        icon={Building2}
      >
        <EmptyState
          icon={Building2}
          title="No entities yet"
          description="Add entities in Settings to map your holdings structure."
          action={{
            label: "Open Settings",
            onClick: () => router.push("/settings?new=entity"),
          }}
        />
      </HoldingsSection>
    );
  }

  return (
    <HoldingsSection
      id="entity-map"
      title="Entity map"
      description="Legal entities, linked projects, IP, and documents."
      icon={Building2}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ entity, stats }) => (
          <EntityCard key={entity.id} entity={entity} stats={stats} />
        ))}
      </div>
    </HoldingsSection>
  );
}

function EntityCard({
  entity,
  stats,
}: {
  entity: Entity;
  stats: ReturnType<typeof selectEntityOwnershipStats>;
}) {
  return (
    <article className="rounded-lg border border-zinc-800/90 bg-zinc-950/50 p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-zinc-100">{entity.name}</h3>
        <Badge variant="outline" className="border-zinc-700 text-zinc-400">
          {formatStatusLabel(entity.status)}
        </Badge>
      </div>
      <p className="mt-1 text-zinc-500">
        {formatStatusLabel(entity.type)} · {entity.jurisdiction ?? "—"}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-zinc-400">
        <div>
          <dt className="text-xs uppercase tracking-wide">IP assets</dt>
          <dd className="text-zinc-200">{stats.ipCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide">Linked docs</dt>
          <dd className="text-zinc-200">{stats.docCount}</dd>
        </div>
      </dl>
      {stats.linkedProjectNames.length > 0 ? (
        <p className="mt-2 text-zinc-400">
          Projects: {stats.linkedProjectNames.join(", ")}
        </p>
      ) : null}
      {stats.complianceHint ? (
        <p className="mt-2 text-amber-200/90">{stats.complianceHint}</p>
      ) : null}
      <Link
        href="/settings"
        className="mt-3 inline-block text-xs text-amber-400/90 hover:underline"
      >
        Edit in Settings →
      </Link>
    </article>
  );
}
