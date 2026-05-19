export type ComplianceReminderStatus =
  | "pending"
  | "completed"
  | "overdue"
  | "cancelled";

export type ComplianceReminderCategory =
  | "annual_filing"
  | "tax"
  | "license"
  | "insurance"
  | "governance"
  | "other";

export interface ComplianceReminder {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  entityId?: string;
  projectId?: string;
  category: ComplianceReminderCategory;
  status: ComplianceReminderStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
