export type DecisionCategory =
  | "product"
  | "finance"
  | "legal"
  | "hiring"
  | "strategy"
  | "investing"
  | "operations";

export type DecisionStatus =
  | "active"
  | "reversed"
  | "under_review"
  | "completed";

export interface Decision {
  id: string;
  title: string;
  summary: string;
  category: DecisionCategory;
  projectId?: string;
  reasoning: string;
  optionsConsidered: string[];
  finalDecision: string;
  expectedOutcome: string;
  reviewDate?: string;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
}
