export type SignalSource =
  | "github"
  | "gmail"
  | "vercel"
  | "task"
  | "decision"
  | "finance"
  | "document"
  | "agent"
  | "action"
  | "project"
  | "holding"
  | "connection"
  | "system"
  | "manual";

export type SignalType =
  | "progress"
  | "risk"
  | "blocker"
  | "opportunity"
  | "revenue"
  | "cost"
  | "deployment"
  | "task"
  | "decision"
  | "document"
  | "approval"
  | "agent"
  | "connection"
  | "note"
  | "system";

export type SignalSeverity = "low" | "medium" | "high" | "critical";

export type SignalStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "dismissed";

/** Deep-triage output attached after cluster analysis (server-generated). */
export type SignalTriageAnalysis = {
  rootCauseEstimate: string;
  operationalImpact: string;
  structuredMitigationStep: string;
  analyzedAt: string;
  source: "anthropic" | "rule-based";
  signalIds: string[];
};

export interface Signal {
  id: string;
  source: SignalSource;
  type: SignalType;
  title: string;
  summary: string;
  severity: SignalSeverity;
  status: SignalStatus;
  projectId?: string;
  entityId?: string;
  relatedRecordType?: string;
  relatedRecordId?: string;
  recommendedAction?: string;
  /** true = this signal was generated from live connector data */
  isLive?: boolean;
  /** true = this signal was derived from local/manual store data */
  isDerived?: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  triageAnalysis?: SignalTriageAnalysis;
}
