export type ActivityEntityType =
  | "project"
  | "task"
  | "decision"
  | "transaction"
  | "document"
  | "entity"
  | "roadmap"
  | "system";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "moved"
  | "reset";

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityName: string;
  description: string;
}
