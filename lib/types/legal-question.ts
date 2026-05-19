export type LegalQuestionStatus =
  | "open"
  | "researching"
  | "answered"
  | "deferred";

export type LegalQuestionPriority = "low" | "medium" | "high";

export interface LegalQuestion {
  id: string;
  question: string;
  context?: string;
  status: LegalQuestionStatus;
  priority: LegalQuestionPriority;
  entityId?: string;
  projectId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
