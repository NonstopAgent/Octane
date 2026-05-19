export type ActivityEntityType =
  | "project"
  | "task"
  | "decision"
  | "transaction"
  | "document"
  | "entity"
  | "roadmap"
  | "work_session"
  | "inbox_item"
  | "founder_note"
  | "system";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "moved"
  | "converted"
  | "archived"
  | "reset";

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  entityName: string;
  description: string;
  createdAt: string;
}
