"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import { PageHeader } from "@/components/layout/page-header";
import { AssetOwnershipSection } from "@/components/modules/holdings/asset-ownership-section";
import { ComplianceCalendarSection } from "@/components/modules/holdings/compliance-calendar-section";
import { DocumentOwnershipSection } from "@/components/modules/holdings/document-ownership-section";
import { EntityMapSection } from "@/components/modules/holdings/entity-map-section";
import { FormationChecklistSection } from "@/components/modules/holdings/formation-checklist-section";
import { HoldingsHealthPanel } from "@/components/modules/holdings/holdings-health-panel";
import { HoldingsOverview } from "@/components/modules/holdings/holdings-overview";
import { LegalQuestionsSection } from "@/components/modules/holdings/legal-questions-section";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";

export default function HoldingsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <HoldingsPageContent />
    </Suspense>
  );
}

function HoldingsPageContent() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));

  const [detailId, setDetailId] = useState<string | null>(null);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [ipOpen, setIpOpen] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    const newParam = searchParams.get("new");
    if (newParam === "compliance") setComplianceOpen(true);
    if (newParam === "legal-question") setLegalOpen(true);
    if (newParam === "checklist") setChecklistOpen(true);
    if (newParam === "ip-asset") setIpOpen(true);
    const detail = searchParams.get("detail");
    if (detail) setDetailId(detail);
  }, [searchParams]);

  const detailSection = useMemo(() => {
    if (!detailId) return null;
    if (state.complianceReminders.some((r) => r.id === detailId)) return "compliance";
    if (state.legalQuestions.some((q) => q.id === detailId)) return "legal";
    if (state.formationChecklistItems.some((i) => i.id === detailId)) {
      return "checklist";
    }
    if (state.ipAssets.some((a) => a.id === detailId)) return "ip";
    if (state.documents.some((d) => d.id === detailId)) return "document";
    if (state.entities.some((e) => e.id === detailId)) return "entity";
    return null;
  }, [detailId, state]);

  useEffect(() => {
    if (!detailSection || !detailId) return;
    const el = document.getElementById(
      detailSection === "compliance"
        ? "compliance-calendar"
        : detailSection === "legal"
          ? "legal-questions"
          : detailSection === "checklist"
            ? "formation-checklist"
            : detailSection === "ip"
              ? "asset-ownership"
              : detailSection === "document"
                ? "document-ownership"
                : "entity-map",
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [detailId, detailSection]);

  return (
    <div className="space-y-8 overflow-x-hidden">
      <PageHeader
        title="Holdings Command Center"
        description="Internal organizer for entities, IP ownership, compliance dates, and legal questions — not legal advice."
      />

      <HoldingsOverview state={state} />
      <HoldingsHealthPanel state={state} />
      <EntityMapSection state={state} />
      <AssetOwnershipSection
        openCreate={ipOpen}
        onCreateOpenChange={setIpOpen}
        detailId={detailSection === "ip" ? detailId : null}
      />
      <DocumentOwnershipSection
        state={state}
        detailId={detailSection === "document" ? detailId : null}
      />
      <ComplianceCalendarSection
        openCreate={complianceOpen}
        onCreateOpenChange={setComplianceOpen}
        detailId={detailSection === "compliance" ? detailId : null}
      />
      <LegalQuestionsSection
        openCreate={legalOpen}
        onCreateOpenChange={setLegalOpen}
        detailId={detailSection === "legal" ? detailId : null}
      />
      <FormationChecklistSection
        openCreate={checklistOpen}
        onCreateOpenChange={setChecklistOpen}
        detailId={detailSection === "checklist" ? detailId : null}
      />
    </div>
  );
}
