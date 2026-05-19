import {
  countFormingEntities,
  countIpOwnershipGaps,
  countLegalDocumentsNeedingReview,
  countOpenLegalQuestions,
  countOverdueComplianceReminders,
  formationChecklistProgress,
} from "@/lib/holdings/metrics";
import type { OctanePersistedState } from "@/lib/store/octane-store";

export type HoldingsHealthBreakdown = {
  entityStructure: number;
  ipOwnership: number;
  documentCompliance: number;
  calendarCompliance: number;
  legalQuestions: number;
  formationProgress: number;
};

export type HoldingsHealthResult = {
  score: number;
  breakdown: HoldingsHealthBreakdown;
  suggestions: string[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeHoldingsHealth(
  state: Pick<
    OctanePersistedState,
    | "entities"
    | "ipAssets"
    | "documents"
    | "complianceReminders"
    | "legalQuestions"
    | "formationChecklistItems"
  >,
  referenceDate: Date = new Date(),
): HoldingsHealthResult {
  const formingCount = countFormingEntities(state.entities);
  const activeCount = state.entities.filter((e) => e.status === "active").length;
  const entityStructure =
    state.entities.length === 0
      ? 40
      : clampScore(
          100 -
            formingCount * 18 -
            (state.entities.some((e) => !e.formationDate && e.status === "active")
              ? 12
              : 0),
        );

  const ipGaps = countIpOwnershipGaps(state.ipAssets);
  const unprotected = state.ipAssets.filter(
    (a) => a.protectionStatus === "unprotected",
  ).length;
  const ipOwnership =
    state.ipAssets.length === 0
      ? 70
      : clampScore(100 - ipGaps * 22 - unprotected * 8);

  const docsNeedingReview = countLegalDocumentsNeedingReview(state.documents);
  const documentCompliance = clampScore(100 - docsNeedingReview * 15);

  const overdue = countOverdueComplianceReminders(
    state.complianceReminders,
    referenceDate,
  );
  const pending = state.complianceReminders.filter(
    (r) => r.status === "pending" || r.status === "overdue",
  ).length;
  const calendarCompliance =
    state.complianceReminders.length === 0
      ? 75
      : clampScore(100 - overdue * 25 - Math.max(0, pending - overdue) * 5);

  const openQuestions = countOpenLegalQuestions(state.legalQuestions);
  const highPriority = state.legalQuestions.filter(
    (q) =>
      q.priority === "high" &&
      (q.status === "open" || q.status === "researching"),
  ).length;
  const legalQuestions =
    state.legalQuestions.length === 0
      ? 80
      : clampScore(100 - openQuestions * 12 - highPriority * 10);

  const { done, total } = formationChecklistProgress(
    state.formationChecklistItems,
  );
  const formationProgress =
    total === 0 ? 70 : clampScore((done / total) * 100);

  const breakdown: HoldingsHealthBreakdown = {
    entityStructure,
    ipOwnership,
    documentCompliance,
    calendarCompliance,
    legalQuestions,
    formationProgress,
  };

  const weights = {
    entityStructure: 0.2,
    ipOwnership: 0.22,
    documentCompliance: 0.18,
    calendarCompliance: 0.18,
    legalQuestions: 0.12,
    formationProgress: 0.1,
  };

  const score = clampScore(
    breakdown.entityStructure * weights.entityStructure +
      breakdown.ipOwnership * weights.ipOwnership +
      breakdown.documentCompliance * weights.documentCompliance +
      breakdown.calendarCompliance * weights.calendarCompliance +
      breakdown.legalQuestions * weights.legalQuestions +
      breakdown.formationProgress * weights.formationProgress,
  );

  const suggestions: string[] = [];
  if (formingCount > 0) {
    suggestions.push("Complete formation for entities still in forming status.");
  }
  if (ipGaps > 0) {
    suggestions.push(
      "Resolve IP ownership gaps where intended owner differs from current owner.",
    );
  }
  if (docsNeedingReview > 0) {
    suggestions.push("Review legal and financial documents flagged for counsel.");
  }
  if (overdue > 0) {
    suggestions.push("Address overdue compliance calendar items.");
  }
  if (openQuestions > 0) {
    suggestions.push("Close or defer open legal questions with your advisor.");
  }
  if (total > 0 && done < total) {
    suggestions.push("Finish remaining formation checklist steps.");
  }
  if (unprotected > 0) {
    suggestions.push("Register or license unprotected IP assets.");
  }
  if (activeCount > 0 && suggestions.length === 0) {
    suggestions.push("Holdings structure looks healthy — keep calendar dates current.");
  }

  return { score, breakdown, suggestions: suggestions.slice(0, 6) };
}
