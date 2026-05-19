export type ActivityEntityType =
  | "project"
  | "task"
  | "decision"
  | "transaction"
  | "document"
  | "entity"
  | "ip_asset"
  | "compliance_reminder"
  | "legal_question"
  | "formation_checklist"
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
