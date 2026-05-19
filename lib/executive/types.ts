import type { OctanePersistedState } from "@/lib/store/octane-store";

export type ExecutiveQuestionCategory =
  | "ownership"
  | "building"
  | "today"
  | "blockers"
  | "changed"
  | "decisions"
  | "money"
  | "agents"
  | "outlook"
  | "risk"
  | "opportunity"
  | "improvement"
  | "unknown";

export type ExecutiveConfidence = "high" | "medium" | "low";

export type ExecutiveSignalSeverity = "info" | "warning" | "critical";

export type ExecutiveSupportingSignal = {
  label: string;
  detail: string;
  severity?: ExecutiveSignalSeverity;
};

export type ExecutiveAnswer = {
  answerTitle: string;
  category: ExecutiveQuestionCategory;
  directAnswer: string;
  supportingSignals: ExecutiveSupportingSignal[];
  recommendedActions: string[];
  relatedProjects: string[];
  relatedTasks: string[];
  relatedDocuments: string[];
  relatedDecisions: string[];
  relatedHoldings: string[];
  relatedAgents: string[];
  confidence: ExecutiveConfidence;
  sensitiveTopicWarning?: string;
};

export type ExecutiveAnswerInput = OctanePersistedState;

export type ClassifiedExecutiveQuestion = {
  category: ExecutiveQuestionCategory;
  matchedKeywords: string[];
  score: number;
};
