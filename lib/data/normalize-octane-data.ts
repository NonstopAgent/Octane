import { createDefaultConnections } from "@/lib/mock/connection-seed";
import { normalizeActivityLogs } from "@/lib/store/activity";
import type { OctanePersistedState } from "@/lib/store/octane-store";
import type { Agent } from "@/lib/types/agent";
import type { ComplianceReminder } from "@/lib/types/compliance-reminder";
import type { Connection, ConnectionProvider, ConnectionStatus } from "@/lib/types/connection";
import type { Decision, DecisionCategory, DecisionStatus } from "@/lib/types/decision";
import type { Document } from "@/lib/types/document";
import type { Entity, EntityStatus, EntityType } from "@/lib/types/entity";
import type { FormationChecklistItem } from "@/lib/types/formation-checklist-item";
import type { FounderNote } from "@/lib/types/founder-note";
import type { InboxItem } from "@/lib/types/inbox-item";
import type { IPAsset } from "@/lib/types/ip-asset";
import type { LegalQuestion } from "@/lib/types/legal-question";
import type {
  OctaneAction,
  OctaneActionSource,
  OctaneActionStatus,
  OctaneActionType,
} from "@/lib/types/octane-action";
import type { Profile } from "@/lib/types/profile";
import type {
  Project,
  ProjectPriority,
  ProjectRevenueStatus,
  ProjectStatus,
} from "@/lib/types/project";
import type {
  ProjectConnection,
  ProjectConnectionKind,
  ProjectConnectionStatus,
} from "@/lib/types/project-connection";
import type { RoadmapItem } from "@/lib/types/roadmap-item";
import type { Task, TaskAssignee, TaskPriority, TaskStatus } from "@/lib/types/task";
import type { Transaction } from "@/lib/types/transaction";
import type { WorkSession } from "@/lib/types/work-session";

export interface NormalizedOctaneState extends OctanePersistedState {
  connections: Connection[];
  octaneActions: OctaneAction[];
  projectConnections: ProjectConnection[];
}

const PROJECT_STATUSES: ProjectStatus[] = [
  "idea",
  "building",
  "testing",
  "launched",
  "paused",
  "killed",
];
const PROJECT_PRIORITIES: ProjectPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];
const REVENUE_STATUSES: ProjectRevenueStatus[] = [
  "none",
  "pre_revenue",
  "early_revenue",
  "recurring",
  "profitable",
];
const TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "blocked",
  "done",
];
const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"];
const TASK_ASSIGNEES: TaskAssignee[] = [
  "Logan",
  "AI Agent",
  "Future Hire",
  "Contractor",
];
const DECISION_STATUSES: DecisionStatus[] = [
  "active",
  "reversed",
  "under_review",
  "completed",
];
const DECISION_CATEGORIES: DecisionCategory[] = [
  "product",
  "finance",
  "legal",
  "hiring",
  "strategy",
  "investing",
  "operations",
];
const ENTITY_TYPES: EntityType[] = [
  "trust",
  "llc",
  "lab",
  "holding",
  "subsidiary",
  "product",
  "other",
];
const ENTITY_STATUSES: EntityStatus[] = [
  "active",
  "forming",
  "inactive",
  "dissolved",
];
const CONNECTION_PROVIDERS: ConnectionProvider[] = [
  "gmail",
  "google_calendar",
  "github",
  "vercel",
  "supabase",
  "cursor",
  "anthropic",
  "openai",
  "stripe",
  "custom",
];
const CONNECTION_STATUSES: ConnectionStatus[] = [
  "not_connected",
  "connected",
  "needs_attention",
  "coming_soon",
];
const ACTION_TYPES: OctaneActionType[] = [
  "add_project",
  "create_task",
  "create_decision",
  "add_entity",
  "connect_github",
  "connect_vercel",
  "add_note",
  "add_reminder",
  "link_project_resource",
];
const ACTION_STATUSES: OctaneActionStatus[] = [
  "proposed",
  "approved",
  "rejected",
  "completed",
  "failed",
];
const ACTION_SOURCES: OctaneActionSource[] = [
  "chat",
  "command_palette",
  "manual",
  "setup",
];
const PROJECT_CONN_KINDS: ProjectConnectionKind[] = [
  "github",
  "vercel",
  "supabase",
  "website",
  "cursor",
];
const PROJECT_CONN_STATUSES: ProjectConnectionStatus[] = [
  "linked",
  "pending",
  "placeholder",
];

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeOptionalString(value: unknown): string | undefined {
  const s = safeString(value);
  return s || undefined;
}

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function safeIsoDate(value: unknown, fallback: string): string {
  const s = safeString(value);
  if (!s) return fallback;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : fallback;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function safeRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function safePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeProfile(raw: unknown, fallback: Profile): Profile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Profile>;
  return {
    id: safeString(r.id, fallback.id),
    name: safeString(r.name, fallback.name),
    role: safeString(r.role, fallback.role || "Founder"),
    email: safeString(r.email, fallback.email),
    timezone: safeString(r.timezone, fallback.timezone || "UTC"),
  };
}

function normalizeProject(raw: unknown, index: number): Project | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Project>;
  const id = safeString(r.id, `proj-normalized-${index}`);
  const now = new Date().toISOString();
  const createdAt = safeIsoDate(r.createdAt, now);
  const updatedAt = safeIsoDate(r.updatedAt, createdAt);
  const name = safeString(r.name, "Untitled project");
  return {
    id,
    name,
    description: safeString(r.description),
    status: pickEnum(r.status, PROJECT_STATUSES, "building"),
    priority: pickEnum(r.priority, PROJECT_PRIORITIES, "medium"),
    owner: safeString(r.owner, "Unassigned"),
    progress: Math.min(100, Math.max(0, safeNumber(r.progress, 0))),
    revenueStatus: pickEnum(r.revenueStatus, REVENUE_STATUSES, "pre_revenue"),
    goals: safeStringArray(r.goals),
    currentPhase: safeOptionalString(r.currentPhase),
    risks: safeStringArray(r.risks),
    nextActions: safeStringArray(r.nextActions),
    revenueNotes: safeOptionalString(r.revenueNotes),
    createdAt,
    updatedAt,
  };
}

function normalizeTask(raw: unknown, index: number, projectIds: Set<string>): Task | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Task>;
  const now = new Date().toISOString();
  const createdAt = safeIsoDate(r.createdAt, now);
  const updatedAt = safeIsoDate(r.updatedAt, createdAt);
  let projectId = safeString(r.projectId);
  if (!projectId || !projectIds.has(projectId)) {
    projectId = projectIds.values().next().value ?? "proj-unassigned";
  }
  return {
    id: safeString(r.id, `task-normalized-${index}`),
    title: safeString(r.title, "Untitled task"),
    description: safeString(r.description),
    projectId,
    assignedTo: pickEnum(r.assignedTo, TASK_ASSIGNEES, "Logan"),
    priority: pickEnum(r.priority, TASK_PRIORITIES, "medium"),
    status: pickEnum(r.status, TASK_STATUSES, "backlog"),
    dueDate: safeOptionalString(r.dueDate),
    tags: safeStringArray(r.tags),
    difficulty: r.difficulty === "easy" || r.difficulty === "medium" || r.difficulty === "hard"
      ? r.difficulty
      : undefined,
    notes: safeOptionalString(r.notes),
    subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
    blockerReason: safeOptionalString(r.blockerReason),
    linkedDocument: r.linkedDocument,
    createdAt,
    updatedAt,
  };
}

function normalizeEntity(raw: unknown, index: number): Entity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Entity>;
  const now = new Date().toISOString();
  const createdAt = safeIsoDate(r.createdAt, now);
  const updatedAt = safeIsoDate(r.updatedAt, createdAt);
  return {
    id: safeString(r.id, `entity-normalized-${index}`),
    name: safeString(r.name, "Untitled entity"),
    tagline: safeOptionalString(r.tagline),
    logoEmoji: safeOptionalString(r.logoEmoji),
    type: pickEnum(r.type, ENTITY_TYPES, "llc"),
    status: pickEnum(r.status, ENTITY_STATUSES, "active"),
    formationDate: safeOptionalString(r.formationDate),
    jurisdiction: safeOptionalString(r.jurisdiction),
    notes: safeOptionalString(r.notes),
    githubRepo: safeOptionalString(r.githubRepo),
    vercelProjectId: safeOptionalString(r.vercelProjectId),
    websiteUrl: safeOptionalString(r.websiteUrl),
    linkedProjectIds: safeStringArray(r.linkedProjectIds),
    createdAt,
    updatedAt,
  };
}

function normalizeDecision(raw: unknown, index: number): Decision | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Decision>;
  const now = new Date().toISOString();
  const createdAt = safeIsoDate(r.createdAt, now);
  const updatedAt = safeIsoDate(r.updatedAt, createdAt);
  return {
    id: safeString(r.id, `decision-normalized-${index}`),
    title: safeString(r.title, "Untitled decision"),
    summary: safeString(r.summary),
    category: pickEnum(r.category, DECISION_CATEGORIES, "strategy"),
    projectId: safeOptionalString(r.projectId),
    reasoning: safeString(r.reasoning),
    optionsConsidered: safeStringArray(r.optionsConsidered),
    finalDecision: safeString(r.finalDecision),
    expectedOutcome: safeString(r.expectedOutcome),
    status: pickEnum(r.status, DECISION_STATUSES, "active"),
    reviewDate: safeOptionalString(r.reviewDate),
    createdAt,
    updatedAt,
  };
}

function normalizeConnection(raw: unknown, index: number): Connection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Connection>;
  const now = new Date().toISOString();
  const createdAt = safeIsoDate(r.createdAt, now);
  const updatedAt = safeIsoDate(r.updatedAt, createdAt);
  return {
    id: safeString(r.id, `conn-normalized-${index}`),
    provider: pickEnum(r.provider, CONNECTION_PROVIDERS, "custom"),
    label: safeString(r.label, "Integration"),
    status: pickEnum(r.status, CONNECTION_STATUSES, "not_connected"),
    description: safeOptionalString(r.description),
    metadata: safeRecord(r.metadata),
    lastSyncedAt: safeOptionalString(r.lastSyncedAt),
    createdAt,
    updatedAt,
  };
}

function normalizeOctaneAction(raw: unknown, index: number): OctaneAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<OctaneAction>;
  const now = new Date().toISOString();
  const proposedAt = safeIsoDate(r.proposedAt, now);
  return {
    id: safeString(r.id, `action-normalized-${index}`),
    type: pickEnum(r.type, ACTION_TYPES, "add_project"),
    status: pickEnum(r.status, ACTION_STATUSES, "proposed"),
    title: safeString(r.title, "Proposed action"),
    description: safeString(r.description),
    payload: safePayload(r.payload),
    source: pickEnum(r.source, ACTION_SOURCES, "manual"),
    projectId: safeOptionalString(r.projectId),
    proposedAt,
    resolvedAt: safeOptionalString(r.resolvedAt),
    errorMessage: safeOptionalString(r.errorMessage),
  };
}

function normalizeProjectConnection(raw: unknown, index: number): ProjectConnection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ProjectConnection>;
  const now = new Date().toISOString();
  const createdAt = safeIsoDate(r.createdAt, now);
  const updatedAt = safeIsoDate(r.updatedAt, createdAt);
  return {
    id: safeString(r.id, `pconn-normalized-${index}`),
    projectId: safeString(r.projectId, ""),
    kind: pickEnum(r.kind, PROJECT_CONN_KINDS, "github"),
    label: safeString(r.label, "Link"),
    url: safeOptionalString(r.url),
    repo: safeOptionalString(r.repo),
    status: pickEnum(r.status, PROJECT_CONN_STATUSES, "placeholder"),
    createdAt,
    updatedAt,
  };
}

function normalizeGenericArray<T>(
  items: unknown,
  normalizer: (raw: unknown, index: number) => T | null,
): T[] {
  return asArray<unknown>(items)
    .map((item, i) => normalizer(item, i))
    .filter((item): item is T => item !== null);
}

/** Normalize all workspace slices with safe defaults — use after sync, import, onboarding. */
export function normalizeOctaneData(
  input: Partial<NormalizedOctaneState> | undefined,
  fallbackProfile?: Profile,
): NormalizedOctaneState {
  const baseProfile: Profile =
    fallbackProfile ?? {
      id: "profile-default",
      name: "",
      role: "Founder",
      email: "",
      timezone: "UTC",
    };

  const profile = normalizeProfile(input?.profile, baseProfile);
  const projects = normalizeGenericArray(input?.projects, normalizeProject);
  const projectIds = new Set(projects.map((p) => p.id));

  const connectionsRaw = asArray<unknown>(input?.connections);
  const connections =
    connectionsRaw.length > 0
      ? normalizeGenericArray(connectionsRaw, normalizeConnection)
      : createDefaultConnections();

  return {
    profile,
    projects,
    tasks: normalizeGenericArray(input?.tasks, (raw, i) =>
      normalizeTask(raw, i, projectIds),
    ),
    entities: normalizeGenericArray(input?.entities, normalizeEntity),
    decisions: normalizeGenericArray(input?.decisions, normalizeDecision),
    roadmapItems: asArray(input?.roadmapItems) as RoadmapItem[],
    transactions: asArray(input?.transactions) as Transaction[],
    documents: asArray(input?.documents) as Document[],
    ipAssets: asArray(input?.ipAssets) as IPAsset[],
    agents: asArray(input?.agents) as Agent[],
    activityLogs: normalizeActivityLogs(input?.activityLogs),
    workSessions: asArray(input?.workSessions) as WorkSession[],
    inboxItems: asArray(input?.inboxItems) as InboxItem[],
    founderNotes: asArray(input?.founderNotes) as FounderNote[],
    complianceReminders: asArray(input?.complianceReminders) as ComplianceReminder[],
    legalQuestions: asArray(input?.legalQuestions) as LegalQuestion[],
    formationChecklistItems: asArray(
      input?.formationChecklistItems,
    ) as FormationChecklistItem[],
    agentLogs: asArray(input?.agentLogs),
    agentRuns: asArray(input?.agentRuns),
    connections,
    octaneActions: normalizeGenericArray(input?.octaneActions, normalizeOctaneAction),
    projectConnections: normalizeGenericArray(
      input?.projectConnections,
      normalizeProjectConnection,
    ).filter((pc) => pc.projectId && projectIds.has(pc.projectId)),
  };
}
