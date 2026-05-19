export interface AgentLog {
  id: string;
  agentId: string;
  timestamp: string; // ISO date
  type:
    | "run"
    | "success"
    | "error"
    | "info"
    | "approval_request"
    | "approval_granted"
    | "approval_denied"
    | "cost";
  message: string;
  cost?: number; // in USD cents
  taskId?: string;
  details?: string;
}

export interface AgentRunRecord {
  id: string;
  agentId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  taskId?: string;
  outcome?: string;
  totalCostCents?: number;
  logs: AgentLog[];
}
