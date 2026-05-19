import type {
  ActivityAction,
  ActivityEntityType,
  ActivityLog,
} from "@/lib/types/activity-log";

import { createId } from "./utils";

const MAX_LOGS = 500;

export function createActivityLog(
  input: Omit<ActivityLog, "id" | "createdAt">,
): ActivityLog {
  return {
    id: createId("act"),
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export function prependActivityLog(
  logs: ActivityLog[],
  input: Omit<ActivityLog, "id" | "createdAt">,
): ActivityLog[] {
  return [createActivityLog(input), ...logs].slice(0, MAX_LOGS);
}

export type ActivityLogInput = {
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  entityName: string;
  description: string;
};

type LegacyActivityLog = Partial<ActivityLog> & {
  timestamp?: string;
};

export function normalizeActivityLogs(
  logs: LegacyActivityLog[] | undefined,
): ActivityLog[] {
  if (!logs?.length) return [];

  return logs.map((log) => {
    const createdAt =
      (typeof log.createdAt === "string" && log.createdAt) ||
      (typeof log.timestamp === "string" && log.timestamp) ||
      new Date().toISOString();

    return {
      id: typeof log.id === "string" ? log.id : createId("act"),
      action: (log.action ?? "updated") as ActivityAction,
      entityType: (log.entityType ?? "system") as ActivityEntityType,
      entityId: log.entityId,
      entityName:
        typeof log.entityName === "string" ? log.entityName : "Unknown",
      description:
        typeof log.description === "string" ? log.description : "",
      createdAt,
    };
  });
}
