"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  HelpCircle,
  Layers,
  Scale,
} from "lucide-react";

import { MetricCard } from "@/components/modules";
import {
  countFormingEntities,
  countIpOwnershipGaps,
  countLegalDocumentsNeedingReview,
  countOpenLegalQuestions,
  countOverdueComplianceReminders,
  countUpcomingComplianceReminders,
  formationChecklistProgress,
} from "@/lib/holdings/metrics";
import { computeHoldingsHealth } from "@/lib/scoring/holdings-health";
import type { OctanePersistedState } from "@/lib/store/octane-store";

export function HoldingsOverview({
  state,
}: {
  state: OctanePersistedState;
}) {
  const metrics = useMemo(() => {
    const health = computeHoldingsHealth(state);
    const formation = formationChecklistProgress(state.formationChecklistItems);
    return {
      healthScore: health.score,
      entities: state.entities.length,
      forming: countFormingEntities(state.entities),
      ipGaps: countIpOwnershipGaps(state.ipAssets),
      docsReview: countLegalDocumentsNeedingReview(state.documents),
      openQuestions: countOpenLegalQuestions(state.legalQuestions),
      overdueCompliance: countOverdueComplianceReminders(
        state.complianceReminders,
      ),
      upcomingCompliance: countUpcomingComplianceReminders(
        state.complianceReminders,
      ),
      formation,
    };
  }, [state]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Holdings health"
          value={metrics.healthScore}
          subtitle="0–100 composite"
          icon={Scale}
        />
        <MetricCard
          title="Entities"
          value={metrics.entities}
          subtitle={
            metrics.forming > 0
              ? `${metrics.forming} forming`
              : "Active structure"
          }
          icon={Building2}
        />
        <MetricCard
          title="IP ownership gaps"
          value={metrics.ipGaps}
          subtitle="Intended ≠ current owner"
          icon={Layers}
        />
        <MetricCard
          title="Docs need review"
          value={metrics.docsReview}
          subtitle="Legal / financial"
          icon={AlertTriangle}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Open legal questions"
          value={metrics.openQuestions}
          subtitle="Organizer only — not advice"
          icon={HelpCircle}
        />
        <MetricCard
          title="Compliance due"
          value={metrics.upcomingCompliance}
          subtitle={`${metrics.overdueCompliance} overdue`}
          icon={CalendarClock}
        />
        <MetricCard
          title="Formation checklist"
          value={
            metrics.formation.total > 0
              ? `${metrics.formation.done}/${metrics.formation.total}`
              : "—"
          }
          subtitle="Steps complete"
          icon={Building2}
        />
      </div>
    </div>
  );
}
