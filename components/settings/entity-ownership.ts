import { addDays, differenceInDays, parseISO, startOfDay } from "date-fns";

import type { Document, Entity, IPAsset, Project } from "@/lib/types";

export type EntityOwnershipStats = {
  linkedProjectNames: string[];
  docCount: number;
  ipCount: number;
  complianceHint: string | null;
};

export function selectEntityOwnershipStats(
  entity: Entity,
  projects: Project[],
  documents: Document[],
  ipAssets: IPAsset[],
  referenceDate: Date = new Date(),
): EntityOwnershipStats {
  const ownedIp = ipAssets.filter((asset) => asset.ownerEntity === entity.id);
  const linkedProjectIds = [
    ...new Set(
      ownedIp
        .map((asset) => asset.projectId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const linkedProjectNames = linkedProjectIds.map(
    (id) => projects.find((project) => project.id === id)?.name ?? id,
  );

  const docCount = documents.filter(
    (doc) => doc.projectId && linkedProjectIds.includes(doc.projectId),
  ).length;

  return {
    linkedProjectNames,
    docCount,
    ipCount: ownedIp.length,
    complianceHint: getEntityComplianceHint(entity, referenceDate),
  };
}

export function getEntityComplianceHint(
  entity: Entity,
  referenceDate: Date = new Date(),
): string | null {
  if (entity.status === "forming") {
    return "Formation in progress — finalize entity filing.";
  }

  if (!entity.formationDate) {
    return "Add formation date for compliance tracking.";
  }

  const formed = startOfDay(parseISO(entity.formationDate));
  const today = startOfDay(referenceDate);
  let anniversary = new Date(
    today.getFullYear(),
    formed.getMonth(),
    formed.getDate(),
  );

  if (anniversary < today) {
    anniversary = addDays(anniversary, 365);
  }

  const daysUntil = differenceInDays(anniversary, today);
  if (daysUntil <= 30) {
    return "Annual compliance review recommended.";
  }

  return null;
}
