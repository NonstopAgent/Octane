export type FormationChecklistStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "blocked";

export interface FormationChecklistItem {
  id: string;
  title: string;
  description?: string;
  status: FormationChecklistStatus;
  entityId?: string;
  sortOrder: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
