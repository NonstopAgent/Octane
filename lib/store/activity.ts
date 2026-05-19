import type {
  ActivityAction,
  ActivityEntityType,
  ActivityLog,
} from "@/lib/types/activity-log";

import { createId } from "./utils";

const MAX_LOGS = 500;

export function createActivityLog(
  input: Omit<ActivityLog, "id" | "timestamp">,
): ActivityLog {
  return {
    id: createId("act"),
    timestamp: new Date().toISOString(),
    ...input,
  };
}

export function prependActivityLog(
  logs: ActivityLog[],
  input: Omit<ActivityLog, "id" | "timestamp">,
): ActivityLog[] {
  return [createActivityLog(input), ...logs].slice(0, MAX_LOGS);
}

export type ActivityLogInput = {
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityName: string;
  description: string;
};
