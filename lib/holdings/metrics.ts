import { differenceInDays, parseISO, startOfDay } from "date-fns";

import type {
  ComplianceReminder,
  Document,
  Entity,
  FormationChecklistItem,
  IPAsset,
  LegalQuestion,
} from "@/lib/types";

export function hasIpOwnershipGap(asset: IPAsset): boolean {
  if (!asset.intendedOwnerEntity) return false;
  return asset.intendedOwnerEntity !== asset.ownerEntity;
}

export function countIpOwnershipGaps(ipAssets: IPAsset[]): number {
  return ipAssets.filter(hasIpOwnershipGap).length;
}

export function countLegalDocumentsNeedingReview(documents: Document[]): number {
  return documents.filter(
    (doc) =>
      doc.status === "needs_review" &&
      ["legal", "compliance", "contracts", "financial"].includes(doc.category),
  ).length;
}

export function countOpenLegalQuestions(questions: LegalQuestion[]): number {
  return questions.filter((q) => q.status === "open" || q.status === "researching")
    .length;
}

export function countOverdueComplianceReminders(
  reminders: ComplianceReminder[],
  referenceDate: Date = new Date(),
): number {
  const today = startOfDay(referenceDate);
  return reminders.filter((reminder) => {
    if (reminder.status === "completed" || reminder.status === "cancelled") {
      return false;
    }
    const due = startOfDay(parseISO(reminder.dueDate));
    return due < today;
  }).length;
}

export function countUpcomingComplianceReminders(
  reminders: ComplianceReminder[],
  referenceDate: Date = new Date(),
  horizonDays = 30,
): number {
  const today = startOfDay(referenceDate);
  return reminders.filter((reminder) => {
    if (reminder.status === "completed" || reminder.status === "cancelled") {
      return false;
    }
    const due = startOfDay(parseISO(reminder.dueDate));
    const days = differenceInDays(due, today);
    return days >= 0 && days <= horizonDays;
  }).length;
}

export function countFormingEntities(entities: Entity[]): number {
  return entities.filter((entity) => entity.status === "forming").length;
}

export function formationChecklistProgress(items: FormationChecklistItem[]): {
  done: number;
  total: number;
} {
  const total = items.length;
  const done = items.filter((item) => item.status === "done").length;
  return { done, total };
}
