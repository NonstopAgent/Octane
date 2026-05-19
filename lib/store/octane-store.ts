import { create } from "zustand";
import { persist } from "zustand/middleware";

import { executeApprovedOctaneAction } from "@/lib/actions/execute-octane-action";
import { normalizeOctaneData } from "@/lib/data/normalize-octane-data";
import {
  exportSnapshotData as buildSnapshot,
  importSnapshotData as parseSnapshot,
} from "@/lib/data/snapshot";
import type { OctaneSnapshot } from "@/lib/data/snapshot";
import { createDefaultConnections } from "@/lib/mock/connection-seed";
import { createBlankState, createSeedData, PROJECT_IDS } from "@/lib/mock/seed";
import type {
  Agent,
  ComplianceReminder,
  Decision,
  Document,
  Entity,
  FormationChecklistItem,
  FounderNote,
  InboxItem,
  IPAsset,
  LegalQuestion,
  Profile,
  Project,
  RoadmapItem,
  Task,
  TaskStatus,
  Transaction,
  WorkSession,
} from "@/lib/types";

import type { ActivityLog } from "@/lib/types/activity-log";
import type { AgentLog, AgentRunRecord } from "@/lib/types/agent-log";
import type { Connection } from "@/lib/types/connection";
import type { OctaneAction } from "@/lib/types/octane-action";
import type { ProjectConnection } from "@/lib/types/project-connection";

import {
  createActivityLog,
  normalizeActivityLogs,
  prependActivityLog,
  type ActivityLogInput,
} from "./activity";
import { createId, timestamps, touch } from "./utils";

export interface OctanePersistedState {
  profile: Profile;
  projects: Project[];
  tasks: Task[];
  decisions: Decision[];
  roadmapItems: RoadmapItem[];
  transactions: Transaction[];
  documents: Document[];
  ipAssets: IPAsset[];
  entities: Entity[];
  agents: Agent[];
  activityLogs: ActivityLog[];
  workSessions: WorkSession[];
  inboxItems: InboxItem[];
  founderNotes: FounderNote[];
  complianceReminders: ComplianceReminder[];
  legalQuestions: LegalQuestion[];
  formationChecklistItems: FormationChecklistItem[];
  agentLogs: AgentLog[];
  agentRuns: AgentRunRecord[];
  connections: Connection[];
  octaneActions: OctaneAction[];
  projectConnections: ProjectConnection[];
}

type CreatableProject = Omit<Project, "id" | "createdAt" | "updatedAt">;
type CreatableTask = Omit<Task, "id" | "createdAt" | "updatedAt">;
type CreatableDecision = Omit<Decision, "id" | "createdAt" | "updatedAt">;
type CreatableRoadmapItem = Omit<RoadmapItem, "id" | "createdAt" | "updatedAt">;
type CreatableTransaction = Omit<Transaction, "id" | "createdAt">;
type CreatableDocument = Omit<Document, "id" | "createdAt" | "updatedAt">;
type CreatableIPAsset = Omit<IPAsset, "id" | "createdAt" | "updatedAt">;
type CreatableEntity = Omit<Entity, "id" | "createdAt" | "updatedAt">;
type CreatableAgent = Omit<Agent, "id" | "createdAt" | "updatedAt">;
type CreatableInboxItem = Omit<InboxItem, "id" | "createdAt" | "updatedAt">;
type CreatableFounderNote = Omit<FounderNote, "id" | "createdAt" | "updatedAt">;
type CreatableComplianceReminder = Omit<
  ComplianceReminder,
  "id" | "createdAt" | "updatedAt"
>;
type CreatableLegalQuestion = Omit<LegalQuestion, "id" | "createdAt" | "updatedAt">;
type CreatableFormationChecklistItem = Omit<
  FormationChecklistItem,
  "id" | "createdAt" | "updatedAt"
>;

type StartWorkSessionInput = {
  title: string;
  projectId?: string;
  taskId?: string;
  notes?: string;
};

type CreatableWorkSessionUpdate = Partial<
  Pick<WorkSession, "title" | "projectId" | "taskId" | "notes" | "outcome">
>;

function workSessionDurationMinutes(
  startedAt: string,
  endedAt: string,
): number {
  return Math.max(
    0,
    Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000,
    ),
  );
}

export interface OctaneStore extends OctanePersistedState {
  // Projects
  createProject: (data: CreatableProject) => Project;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  getProjectById: (id: string) => Project | undefined;

  // Tasks
  createTask: (data: CreatableTask) => Task;
  updateTask: (id: string, data: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTaskStatus: (id: string, status: TaskStatus) => void;
  convertTaskToDecision: (taskId: string) => Decision | undefined;
  getTaskById: (id: string) => Task | undefined;
  getTasksByProject: (projectId: string) => Task[];

  // Decisions
  createDecision: (data: CreatableDecision) => Decision;
  updateDecision: (id: string, data: Partial<Decision>) => void;
  deleteDecision: (id: string) => void;
  getDecisionById: (id: string) => Decision | undefined;

  // Roadmap
  createRoadmapItem: (data: CreatableRoadmapItem) => RoadmapItem;
  updateRoadmapItem: (id: string, data: Partial<RoadmapItem>) => void;
  deleteRoadmapItem: (id: string) => void;
  getRoadmapItemById: (id: string) => RoadmapItem | undefined;

  // Transactions
  createTransaction: (data: CreatableTransaction) => Transaction;
  updateTransaction: (id: string, data: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  getTransactionById: (id: string) => Transaction | undefined;

  // Documents
  createDocument: (data: CreatableDocument) => Document;
  updateDocument: (id: string, data: Partial<Document>) => void;
  deleteDocument: (id: string) => void;
  getDocumentById: (id: string) => Document | undefined;

  // IP assets
  createIPAsset: (data: CreatableIPAsset) => IPAsset;
  updateIPAsset: (id: string, data: Partial<IPAsset>) => void;
  deleteIPAsset: (id: string) => void;
  getIPAssetById: (id: string) => IPAsset | undefined;

  // Entities
  createEntity: (data: CreatableEntity) => Entity;
  updateEntity: (id: string, data: Partial<Entity>) => void;
  deleteEntity: (id: string) => void;
  getEntityById: (id: string) => Entity | undefined;

  // Agents
  createAgent: (data: CreatableAgent) => Agent;
  updateAgent: (id: string, data: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  getAgentById: (id: string) => Agent | undefined;
  updateAgentStatus: (agentId: string, status: Agent["status"]) => void;
  assignAgentToTask: (agentId: string, taskId: string) => void;
  assignAgentToProject: (agentId: string, projectId: string) => void;

  // Agent logs & runs
  addAgentLog: (log: Omit<AgentLog, "id" | "timestamp">) => AgentLog;
  startAgentRun: (agentId: string, taskId?: string) => string;
  completeAgentRun: (runId: string, outcome: string, totalCostCents?: number) => void;
  failAgentRun: (runId: string, reason: string) => void;
  clearAgentLogs: (agentId: string) => void;

  // Profile
  updateProfile: (data: Partial<Profile>) => void;

  // Work sessions
  startWorkSession: (data: StartWorkSessionInput) => WorkSession;
  completeWorkSession: (
    id: string,
    data?: Pick<WorkSession, "outcome" | "notes">,
  ) => WorkSession | undefined;
  abandonWorkSession: (
    id: string,
    data?: Pick<WorkSession, "notes">,
  ) => WorkSession | undefined;
  updateWorkSession: (id: string, data: CreatableWorkSessionUpdate) => void;
  deleteWorkSession: (id: string) => void;
  getWorkSessionById: (id: string) => WorkSession | undefined;

  // Inbox
  createInboxItem: (data: CreatableInboxItem) => InboxItem;
  updateInboxItem: (id: string, data: Partial<InboxItem>) => void;
  convertInboxItemToTask: (inboxId: string) => Task | undefined;
  convertInboxItemToDecision: (inboxId: string) => Decision | undefined;
  convertInboxItemToFounderNote: (inboxId: string) => FounderNote | undefined;
  archiveInboxItem: (id: string) => void;
  deleteInboxItem: (id: string) => void;
  getInboxItemById: (id: string) => InboxItem | undefined;

  // Founder notes
  createFounderNote: (data: CreatableFounderNote) => FounderNote;
  updateFounderNote: (id: string, data: Partial<FounderNote>) => void;
  deleteFounderNote: (id: string) => void;
  getFounderNoteById: (id: string) => FounderNote | undefined;

  // Compliance reminders
  createComplianceReminder: (data: CreatableComplianceReminder) => ComplianceReminder;
  updateComplianceReminder: (
    id: string,
    data: Partial<ComplianceReminder>,
  ) => void;
  deleteComplianceReminder: (id: string) => void;
  getComplianceReminderById: (id: string) => ComplianceReminder | undefined;

  // Legal questions
  createLegalQuestion: (data: CreatableLegalQuestion) => LegalQuestion;
  updateLegalQuestion: (id: string, data: Partial<LegalQuestion>) => void;
  deleteLegalQuestion: (id: string) => void;
  getLegalQuestionById: (id: string) => LegalQuestion | undefined;

  // Formation checklist
  createFormationChecklistItem: (
    data: CreatableFormationChecklistItem,
  ) => FormationChecklistItem;
  updateFormationChecklistItem: (
    id: string,
    data: Partial<FormationChecklistItem>,
  ) => void;
  deleteFormationChecklistItem: (id: string) => void;
  getFormationChecklistItemById: (
    id: string,
  ) => FormationChecklistItem | undefined;

  // Bulk
  resetToSeed: () => void;
  exportSnapshotData: () => OctaneSnapshot;
  importSnapshotData: (raw: unknown) => void;
  clearLocalData: () => void;
  /** Wipe ALL local data to a truly empty state (used before onboarding / "Start Fresh") */
  clearToBlank: () => void;

  // Connections hub
  createConnection: (
    data: Omit<Connection, "id" | "createdAt" | "updatedAt">,
  ) => Connection;
  updateConnection: (id: string, data: Partial<Connection>) => void;
  deleteConnection: (id: string) => void;
  getConnectionById: (id: string) => Connection | undefined;

  // Octane actions (approval flow)
  proposeOctaneAction: (
    data: Omit<OctaneAction, "id" | "status" | "proposedAt">,
  ) => OctaneAction;
  proposeOctaneActions: (
    actions: Omit<OctaneAction, "id" | "status" | "proposedAt">[],
  ) => OctaneAction[];
  approveOctaneAction: (id: string) => void;
  rejectOctaneAction: (id: string) => void;
  completeOctaneAction: (id: string) => void;
  failOctaneAction: (id: string, errorMessage: string) => void;
  getOctaneActionById: (id: string) => OctaneAction | undefined;

  // Project connections
  createProjectConnection: (
    data: Omit<ProjectConnection, "id" | "createdAt" | "updatedAt">,
  ) => ProjectConnection;
  updateProjectConnection: (id: string, data: Partial<ProjectConnection>) => void;
  deleteProjectConnection: (id: string) => void;
  getProjectConnectionsByProject: (projectId: string) => ProjectConnection[];
  recordActivity: (input: ActivityLogInput) => void;
}

const STORAGE_KEY = "octane-core-storage";

export function selectOctanePersistedState(
  state: OctaneStore,
): OctanePersistedState {
  return {
    profile: state.profile,
    projects: state.projects,
    tasks: state.tasks,
    decisions: state.decisions,
    roadmapItems: state.roadmapItems,
    transactions: state.transactions,
    documents: state.documents,
    ipAssets: state.ipAssets,
    entities: state.entities,
    agents: state.agents,
    activityLogs: state.activityLogs,
    workSessions: state.workSessions,
    inboxItems: state.inboxItems,
    founderNotes: state.founderNotes,
    complianceReminders: state.complianceReminders,
    legalQuestions: state.legalQuestions,
    formationChecklistItems: state.formationChecklistItems,
    agentLogs: state.agentLogs,
    agentRuns: state.agentRuns,
    connections: state.connections,
    octaneActions: state.octaneActions,
    projectConnections: state.projectConnections,
  };
}

function logActivity(
  set: (
    partial:
      | OctaneStore
      | Partial<OctaneStore>
      | ((state: OctaneStore) => OctaneStore | Partial<OctaneStore>),
  ) => void,
  get: () => OctaneStore,
  input: ActivityLogInput,
) {
  set({
    activityLogs: prependActivityLog(get().activityLogs, input),
  });
}

function isPersistedStateEmpty(
  state: Partial<OctanePersistedState> | undefined,
): boolean {
  if (!state) return true;
  return (
    !state.projects?.length &&
    !state.tasks?.length &&
    !state.decisions?.length &&
    !state.profile
  );
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizePersistedState(
  persisted: Partial<OctanePersistedState> | undefined,
): Partial<OctanePersistedState> | undefined {
  if (!persisted) return undefined;
  return normalizeOctaneData(persisted);
}

export const useOctaneStore = create<OctaneStore>()(
  persist(
    (set, get) => ({
      ...createSeedData(),

      createProject: (data) => {
        const project: Project = {
          ...data,
          id: createId("proj"),
          ...timestamps(),
        };
        set((state) => ({ projects: [...state.projects, project] }));
        logActivity(set, get, {
          action: "created",
          entityType: "project",
          entityId: project.id,
          entityName: project.name,
          description: `Created project "${project.name}"`,
        });
        return project;
      },
      updateProject: (id, data) => {
        const existing = get().projects.find((p) => p.id === id);
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...data, ...touch() } : p,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "project",
            entityId: id,
            entityName: data.name ?? existing.name,
            description: `Updated project "${data.name ?? existing.name}"`,
          });
        }
      },
      deleteProject: (id) => {
        const existing = get().projects.find((p) => p.id === id);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "project",
            entityId: id,
            entityName: existing.name,
            description: `Deleted project "${existing.name}"`,
          });
        }
      },
      getProjectById: (id) => get().projects.find((p) => p.id === id),

      createTask: (data) => {
        const task: Task = {
          ...data,
          subtasks: data.subtasks ?? [],
          id: createId("task"),
          ...timestamps(),
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
        logActivity(set, get, {
          action: "created",
          entityType: "task",
          entityId: task.id,
          entityName: task.title,
          description: `Created task "${task.title}"`,
        });
        return task;
      },
      updateTask: (id, data) => {
        const existing = get().tasks.find((t) => t.id === id);
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...data, ...touch() } : t,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "task",
            entityId: id,
            entityName: data.title ?? existing.title,
            description: `Updated task "${data.title ?? existing.title}"`,
          });
        }
      },
      deleteTask: (id) => {
        const existing = get().tasks.find((t) => t.id === id);
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "task",
            entityId: id,
            entityName: existing.title,
            description: `Deleted task "${existing.title}"`,
          });
        }
      },
      moveTaskStatus: (id, status) => {
        const existing = get().tasks.find((t) => t.id === id);
        const now = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            const completedAt =
              status === "done"
                ? t.completedAt ?? now
                : t.completedAt;
            return { ...t, status, completedAt, ...touch() };
          }),
        }));
        if (existing && existing.status !== status) {
          logActivity(set, get, {
            action: "moved",
            entityType: "task",
            entityId: id,
            entityName: existing.title,
            description: `Moved task "${existing.title}" to ${status.replace("_", " ")}`,
          });
        }
      },
      convertTaskToDecision: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (!task) return undefined;
        const decision = get().createDecision({
          title: `Decision: ${task.title}`,
          summary: task.description || task.notes || "Converted from task",
          category: "operations",
          projectId: task.projectId,
          reasoning: task.blockerReason
            ? `Blocker: ${task.blockerReason}`
            : "Converted from an open task.",
          optionsConsidered: [],
          finalDecision: "",
          expectedOutcome: "",
          status: "active",
        });
        logActivity(set, get, {
          action: "created",
          entityType: "decision",
          entityId: decision.id,
          entityName: decision.title,
          description: `Converted task "${task.title}" to decision`,
        });
        return decision;
      },
      getTaskById: (id) => get().tasks.find((t) => t.id === id),
      getTasksByProject: (projectId) =>
        get().tasks.filter((t) => t.projectId === projectId),

      createDecision: (data) => {
        const decision: Decision = {
          ...data,
          id: createId("dec"),
          ...timestamps(),
        };
        set((state) => ({ decisions: [...state.decisions, decision] }));
        logActivity(set, get, {
          action: "created",
          entityType: "decision",
          entityId: decision.id,
          entityName: decision.title,
          description: `Created decision "${decision.title}"`,
        });
        return decision;
      },
      updateDecision: (id, data) => {
        const existing = get().decisions.find((d) => d.id === id);
        set((state) => ({
          decisions: state.decisions.map((d) =>
            d.id === id ? { ...d, ...data, ...touch() } : d,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "decision",
            entityId: id,
            entityName: data.title ?? existing.title,
            description: `Updated decision "${data.title ?? existing.title}"`,
          });
        }
      },
      deleteDecision: (id) => {
        const existing = get().decisions.find((d) => d.id === id);
        set((state) => ({
          decisions: state.decisions.filter((d) => d.id !== id),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "decision",
            entityId: id,
            entityName: existing.title,
            description: `Deleted decision "${existing.title}"`,
          });
        }
      },
      getDecisionById: (id) => get().decisions.find((d) => d.id === id),

      createRoadmapItem: (data) => {
        const item: RoadmapItem = {
          ...data,
          id: createId("road"),
          ...timestamps(),
        };
        set((state) => ({ roadmapItems: [...state.roadmapItems, item] }));
        logActivity(set, get, {
          action: "created",
          entityType: "roadmap",
          entityId: item.id,
          entityName: item.title,
          description: `Created roadmap item "${item.title}"`,
        });
        return item;
      },
      updateRoadmapItem: (id, data) => {
        const existing = get().roadmapItems.find((r) => r.id === id);
        set((state) => ({
          roadmapItems: state.roadmapItems.map((r) =>
            r.id === id ? { ...r, ...data, ...touch() } : r,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "roadmap",
            entityId: id,
            entityName: data.title ?? existing.title,
            description: `Updated roadmap item "${data.title ?? existing.title}"`,
          });
        }
      },
      deleteRoadmapItem: (id) => {
        const existing = get().roadmapItems.find((r) => r.id === id);
        set((state) => ({
          roadmapItems: state.roadmapItems.filter((r) => r.id !== id),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "roadmap",
            entityId: id,
            entityName: existing.title,
            description: `Deleted roadmap item "${existing.title}"`,
          });
        }
      },
      getRoadmapItemById: (id) => get().roadmapItems.find((r) => r.id === id),

      createTransaction: (data) => {
        const transaction: Transaction = {
          ...data,
          id: createId("txn"),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          transactions: [...state.transactions, transaction],
        }));
        logActivity(set, get, {
          action: "created",
          entityType: "transaction",
          entityId: transaction.id,
          entityName: `${transaction.type} · ${transaction.category}`,
          description: `Added ${transaction.type} transaction (${transaction.amount})`,
        });
        return transaction;
      },
      updateTransaction: (id, data) => {
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...data } : t,
          ),
        }));
      },
      deleteTransaction: (id) => {
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        }));
      },
      getTransactionById: (id) =>
        get().transactions.find((t) => t.id === id),

      createDocument: (data) => {
        const document: Document = {
          ...data,
          id: createId("doc"),
          ...timestamps(),
        };
        set((state) => ({ documents: [...state.documents, document] }));
        logActivity(set, get, {
          action: "created",
          entityType: "document",
          entityId: document.id,
          entityName: document.name,
          description: `Added document metadata "${document.name}"`,
        });
        return document;
      },
      updateDocument: (id, data) => {
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === id ? { ...d, ...data, ...touch() } : d,
          ),
        }));
      },
      deleteDocument: (id) => {
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== id),
        }));
      },
      getDocumentById: (id) => get().documents.find((d) => d.id === id),

      createIPAsset: (data) => {
        const asset: IPAsset = {
          ...data,
          id: createId("ip"),
          ...timestamps(),
        };
        set((state) => ({ ipAssets: [...state.ipAssets, asset] }));
        logActivity(set, get, {
          action: "created",
          entityType: "ip_asset",
          entityId: asset.id,
          entityName: asset.name,
          description: `Created IP asset "${asset.name}"`,
        });
        return asset;
      },
      updateIPAsset: (id, data) => {
        const existing = get().ipAssets.find((a) => a.id === id);
        set((state) => ({
          ipAssets: state.ipAssets.map((a) =>
            a.id === id ? { ...a, ...data, ...touch() } : a,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "ip_asset",
            entityId: id,
            entityName: data.name ?? existing.name,
            description: `Updated IP asset "${data.name ?? existing.name}"`,
          });
        }
      },
      deleteIPAsset: (id) => {
        const existing = get().ipAssets.find((a) => a.id === id);
        set((state) => ({
          ipAssets: state.ipAssets.filter((a) => a.id !== id),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "ip_asset",
            entityId: id,
            entityName: existing.name,
            description: `Deleted IP asset "${existing.name}"`,
          });
        }
      },
      getIPAssetById: (id) => get().ipAssets.find((a) => a.id === id),

      createEntity: (data) => {
        const entity: Entity = {
          ...data,
          id: createId("entity"),
          ...timestamps(),
        };
        set((state) => ({ entities: [...state.entities, entity] }));
        logActivity(set, get, {
          action: "created",
          entityType: "entity",
          entityId: entity.id,
          entityName: entity.name,
          description: `Created entity "${entity.name}"`,
        });
        return entity;
      },
      updateEntity: (id, data) => {
        const existing = get().entities.find((e) => e.id === id);
        set((state) => ({
          entities: state.entities.map((e) =>
            e.id === id ? { ...e, ...data, ...touch() } : e,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "entity",
            entityId: id,
            entityName: data.name ?? existing.name,
            description: `Updated entity "${data.name ?? existing.name}"`,
          });
        }
      },
      deleteEntity: (id) => {
        set((state) => ({
          entities: state.entities.filter((e) => e.id !== id),
        }));
      },
      getEntityById: (id) => get().entities.find((e) => e.id === id),

      createAgent: (data) => {
        const agent: Agent = {
          ...data,
          id: createId("agent"),
          ...timestamps(),
        };
        set((state) => ({ agents: [...state.agents, agent] }));
        return agent;
      },
      updateAgent: (id, data) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === id ? { ...a, ...data, ...touch() } : a,
          ),
        }));
      },
      deleteAgent: (id) => {
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
        }));
      },
      getAgentById: (id) => get().agents.find((a) => a.id === id),

      updateAgentStatus: (agentId, status) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, status, ...touch() } : a,
          ),
        }));
      },

      assignAgentToTask: (agentId, taskId) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, currentTask: taskId, ...touch() } : a,
          ),
        }));
      },

      assignAgentToProject: (agentId, projectId) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, assignedProjectId: projectId, ...touch() }
              : a,
          ),
        }));
      },

      addAgentLog: (log) => {
        const newLog: AgentLog = {
          ...log,
          id: createId("alog"),
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          agentLogs: [newLog, ...state.agentLogs],
        }));
        return newLog;
      },

      startAgentRun: (agentId, taskId) => {
        const runId = createId("run");
        const run: AgentRunRecord = {
          id: runId,
          agentId,
          startedAt: new Date().toISOString(),
          status: "running",
          taskId,
          logs: [],
        };
        set((state) => ({
          agentRuns: [run, ...state.agentRuns],
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, status: "running", lastRunAt: run.startedAt, ...touch() }
              : a,
          ),
        }));
        return runId;
      },

      completeAgentRun: (runId, outcome, totalCostCents) => {
        const completedAt = new Date().toISOString();
        set((state) => {
          const run = state.agentRuns.find((r) => r.id === runId);
          return {
            agentRuns: state.agentRuns.map((r) =>
              r.id === runId
                ? { ...r, status: "completed", completedAt, outcome, totalCostCents }
                : r,
            ),
            agents: run
              ? state.agents.map((a) =>
                  a.id === run.agentId
                    ? { ...a, status: "idle", ...touch() }
                    : a,
                )
              : state.agents,
          };
        });
      },

      failAgentRun: (runId, reason) => {
        const completedAt = new Date().toISOString();
        set((state) => {
          const run = state.agentRuns.find((r) => r.id === runId);
          return {
            agentRuns: state.agentRuns.map((r) =>
              r.id === runId
                ? { ...r, status: "failed", completedAt, outcome: reason }
                : r,
            ),
            agents: run
              ? state.agents.map((a) =>
                  a.id === run.agentId
                    ? { ...a, status: "error", ...touch() }
                    : a,
                )
              : state.agents,
          };
        });
      },

      clearAgentLogs: (agentId) => {
        set((state) => ({
          agentLogs: state.agentLogs.filter((l) => l.agentId !== agentId),
          agentRuns: state.agentRuns.filter((r) => r.agentId !== agentId),
        }));
      },

      updateProfile: (data) => {
        set((state) => ({
          profile: { ...state.profile, ...data },
        }));
      },

      startWorkSession: (data) => {
        const session: WorkSession = {
          title: data.title,
          projectId: data.projectId,
          taskId: data.taskId,
          notes: data.notes,
          id: createId("ws"),
          startedAt: new Date().toISOString(),
          status: "active",
          ...timestamps(),
        };
        set((state) => ({
          workSessions: [...state.workSessions, session],
        }));
        logActivity(set, get, {
          action: "created",
          entityType: "work_session",
          entityId: session.id,
          entityName: session.title,
          description: `Started work session "${session.title}"`,
        });
        return session;
      },
      completeWorkSession: (id, data) => {
        const existing = get().workSessions.find((s) => s.id === id);
        if (!existing || existing.status !== "active") return undefined;
        const endedAt = new Date().toISOString();
        const session: WorkSession = {
          ...existing,
          ...data,
          endedAt,
          status: "completed",
          durationMinutes: workSessionDurationMinutes(
            existing.startedAt,
            endedAt,
          ),
          ...touch(),
        };
        set((state) => ({
          workSessions: state.workSessions.map((s) =>
            s.id === id ? session : s,
          ),
        }));
        logActivity(set, get, {
          action: "updated",
          entityType: "work_session",
          entityId: id,
          entityName: session.title,
          description: `Completed work session "${session.title}"`,
        });
        return session;
      },
      abandonWorkSession: (id, data) => {
        const existing = get().workSessions.find((s) => s.id === id);
        if (!existing || existing.status !== "active") return undefined;
        const endedAt = new Date().toISOString();
        const session: WorkSession = {
          ...existing,
          ...data,
          endedAt,
          status: "abandoned",
          durationMinutes: workSessionDurationMinutes(
            existing.startedAt,
            endedAt,
          ),
          ...touch(),
        };
        set((state) => ({
          workSessions: state.workSessions.map((s) =>
            s.id === id ? session : s,
          ),
        }));
        logActivity(set, get, {
          action: "updated",
          entityType: "work_session",
          entityId: id,
          entityName: session.title,
          description: `Abandoned work session "${session.title}"`,
        });
        return session;
      },
      updateWorkSession: (id, data) => {
        const existing = get().workSessions.find((s) => s.id === id);
        set((state) => ({
          workSessions: state.workSessions.map((s) =>
            s.id === id ? { ...s, ...data, ...touch() } : s,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "work_session",
            entityId: id,
            entityName: data.title ?? existing.title,
            description: `Updated work session "${data.title ?? existing.title}"`,
          });
        }
      },
      deleteWorkSession: (id) => {
        const existing = get().workSessions.find((s) => s.id === id);
        set((state) => ({
          workSessions: state.workSessions.filter((s) => s.id !== id),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "work_session",
            entityId: id,
            entityName: existing.title,
            description: `Deleted work session "${existing.title}"`,
          });
        }
      },
      getWorkSessionById: (id) => get().workSessions.find((s) => s.id === id),

      createInboxItem: (data) => {
        const item: InboxItem = {
          ...data,
          status: data.status ?? "unprocessed",
          id: createId("inbox"),
          ...timestamps(),
        };
        set((state) => ({ inboxItems: [...state.inboxItems, item] }));
        logActivity(set, get, {
          action: "created",
          entityType: "inbox_item",
          entityId: item.id,
          entityName: item.title,
          description: `Captured inbox item "${item.title}"`,
        });
        return item;
      },
      updateInboxItem: (id, data) => {
        const existing = get().inboxItems.find((i) => i.id === id);
        set((state) => ({
          inboxItems: state.inboxItems.map((i) =>
            i.id === id ? { ...i, ...data, ...touch() } : i,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "inbox_item",
            entityId: id,
            entityName: data.title ?? existing.title,
            description: `Updated inbox item "${data.title ?? existing.title}"`,
          });
        }
      },
      convertInboxItemToTask: (inboxId) => {
        const item = get().inboxItems.find((i) => i.id === inboxId);
        if (!item || item.status !== "unprocessed") return undefined;
        const projectId =
          item.linkedProjectId ??
          get().projects[0]?.id ??
          PROJECT_IDS.core;
        const task = get().createTask({
          title: item.title,
          description: item.body ?? "Converted from inbox",
          projectId,
          assignedTo: "Logan",
          priority: "medium",
          status: "backlog",
          tags: ["inbox"],
        });
        set((state) => ({
          inboxItems: state.inboxItems.map((i) =>
            i.id === inboxId
              ? { ...i, status: "converted" as const, ...touch() }
              : i,
          ),
        }));
        logActivity(set, get, {
          action: "converted",
          entityType: "inbox_item",
          entityId: inboxId,
          entityName: item.title,
          description: `Converted inbox item "${item.title}" to task`,
        });
        return task;
      },
      convertInboxItemToDecision: (inboxId) => {
        const item = get().inboxItems.find((i) => i.id === inboxId);
        if (!item || item.status !== "unprocessed") return undefined;
        const decision = get().createDecision({
          title: item.title,
          summary: item.body ?? "Converted from inbox",
          category: "operations",
          projectId: item.linkedProjectId,
          reasoning: "Captured in inbox and converted to a decision record.",
          optionsConsidered: [],
          finalDecision: "",
          expectedOutcome: "",
          status: "active",
        });
        set((state) => ({
          inboxItems: state.inboxItems.map((i) =>
            i.id === inboxId
              ? { ...i, status: "converted" as const, ...touch() }
              : i,
          ),
        }));
        logActivity(set, get, {
          action: "converted",
          entityType: "inbox_item",
          entityId: inboxId,
          entityName: item.title,
          description: `Converted inbox item "${item.title}" to decision`,
        });
        return decision;
      },
      convertInboxItemToFounderNote: (inboxId) => {
        const item = get().inboxItems.find((i) => i.id === inboxId);
        if (!item || item.status !== "unprocessed") return undefined;
        const note = get().createFounderNote({
          title: item.title,
          body: item.body ?? "",
          linkedProjectId: item.linkedProjectId,
          tags: ["inbox"],
        });
        set((state) => ({
          inboxItems: state.inboxItems.map((i) =>
            i.id === inboxId
              ? { ...i, status: "converted" as const, ...touch() }
              : i,
          ),
        }));
        logActivity(set, get, {
          action: "converted",
          entityType: "inbox_item",
          entityId: inboxId,
          entityName: item.title,
          description: `Converted inbox item "${item.title}" to founder note`,
        });
        return note;
      },
      archiveInboxItem: (id) => {
        const existing = get().inboxItems.find((i) => i.id === id);
        set((state) => ({
          inboxItems: state.inboxItems.map((i) =>
            i.id === id ? { ...i, status: "archived", ...touch() } : i,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "archived",
            entityType: "inbox_item",
            entityId: id,
            entityName: existing.title,
            description: `Archived inbox item "${existing.title}"`,
          });
        }
      },
      deleteInboxItem: (id) => {
        const existing = get().inboxItems.find((i) => i.id === id);
        set((state) => ({
          inboxItems: state.inboxItems.filter((i) => i.id !== id),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "inbox_item",
            entityId: id,
            entityName: existing.title,
            description: `Deleted inbox item "${existing.title}"`,
          });
        }
      },
      getInboxItemById: (id) => get().inboxItems.find((i) => i.id === id),

      createFounderNote: (data) => {
        const note: FounderNote = {
          ...data,
          tags: data.tags ?? [],
          id: createId("fnote"),
          ...timestamps(),
        };
        set((state) => ({ founderNotes: [...state.founderNotes, note] }));
        logActivity(set, get, {
          action: "created",
          entityType: "founder_note",
          entityId: note.id,
          entityName: note.title,
          description: `Created founder note "${note.title}"`,
        });
        return note;
      },
      updateFounderNote: (id, data) => {
        const existing = get().founderNotes.find((n) => n.id === id);
        set((state) => ({
          founderNotes: state.founderNotes.map((n) =>
            n.id === id ? { ...n, ...data, ...touch() } : n,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "founder_note",
            entityId: id,
            entityName: data.title ?? existing.title,
            description: `Updated founder note "${data.title ?? existing.title}"`,
          });
        }
      },
      deleteFounderNote: (id) => {
        const existing = get().founderNotes.find((n) => n.id === id);
        set((state) => ({
          founderNotes: state.founderNotes.filter((n) => n.id !== id),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "founder_note",
            entityId: id,
            entityName: existing.title,
            description: `Deleted founder note "${existing.title}"`,
          });
        }
      },
      getFounderNoteById: (id) => get().founderNotes.find((n) => n.id === id),

      createComplianceReminder: (data) => {
        const reminder: ComplianceReminder = {
          ...data,
          id: createId("compliance"),
          ...timestamps(),
        };
        set((state) => ({
          complianceReminders: [...state.complianceReminders, reminder],
        }));
        logActivity(set, get, {
          action: "created",
          entityType: "compliance_reminder",
          entityId: reminder.id,
          entityName: reminder.title,
          description: `Added compliance reminder "${reminder.title}"`,
        });
        return reminder;
      },
      updateComplianceReminder: (id, data) => {
        const existing = get().complianceReminders.find((r) => r.id === id);
        set((state) => ({
          complianceReminders: state.complianceReminders.map((r) =>
            r.id === id ? { ...r, ...data, ...touch() } : r,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "compliance_reminder",
            entityId: id,
            entityName: data.title ?? existing.title,
            description: `Updated compliance reminder "${data.title ?? existing.title}"`,
          });
        }
      },
      deleteComplianceReminder: (id) => {
        const existing = get().complianceReminders.find((r) => r.id === id);
        set((state) => ({
          complianceReminders: state.complianceReminders.filter(
            (r) => r.id !== id,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "compliance_reminder",
            entityId: id,
            entityName: existing.title,
            description: `Deleted compliance reminder "${existing.title}"`,
          });
        }
      },
      getComplianceReminderById: (id) =>
        get().complianceReminders.find((r) => r.id === id),

      createLegalQuestion: (data) => {
        const question: LegalQuestion = {
          ...data,
          id: createId("legal-q"),
          ...timestamps(),
        };
        set((state) => ({
          legalQuestions: [...state.legalQuestions, question],
        }));
        logActivity(set, get, {
          action: "created",
          entityType: "legal_question",
          entityId: question.id,
          entityName: question.question.slice(0, 80),
          description: `Logged legal question`,
        });
        return question;
      },
      updateLegalQuestion: (id, data) => {
        const existing = get().legalQuestions.find((q) => q.id === id);
        set((state) => ({
          legalQuestions: state.legalQuestions.map((q) =>
            q.id === id ? { ...q, ...data, ...touch() } : q,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "legal_question",
            entityId: id,
            entityName: (data.question ?? existing.question).slice(0, 80),
            description: `Updated legal question`,
          });
        }
      },
      deleteLegalQuestion: (id) => {
        const existing = get().legalQuestions.find((q) => q.id === id);
        set((state) => ({
          legalQuestions: state.legalQuestions.filter((q) => q.id !== id),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "legal_question",
            entityId: id,
            entityName: existing.question.slice(0, 80),
            description: `Deleted legal question`,
          });
        }
      },
      getLegalQuestionById: (id) =>
        get().legalQuestions.find((q) => q.id === id),

      createFormationChecklistItem: (data) => {
        const item: FormationChecklistItem = {
          ...data,
          id: createId("formation"),
          ...timestamps(),
        };
        set((state) => ({
          formationChecklistItems: [...state.formationChecklistItems, item],
        }));
        logActivity(set, get, {
          action: "created",
          entityType: "formation_checklist",
          entityId: item.id,
          entityName: item.title,
          description: `Added formation checklist item "${item.title}"`,
        });
        return item;
      },
      updateFormationChecklistItem: (id, data) => {
        const existing = get().formationChecklistItems.find((i) => i.id === id);
        set((state) => ({
          formationChecklistItems: state.formationChecklistItems.map((i) =>
            i.id === id ? { ...i, ...data, ...touch() } : i,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "formation_checklist",
            entityId: id,
            entityName: data.title ?? existing.title,
            description: `Updated formation checklist "${data.title ?? existing.title}"`,
          });
        }
      },
      deleteFormationChecklistItem: (id) => {
        const existing = get().formationChecklistItems.find((i) => i.id === id);
        set((state) => ({
          formationChecklistItems: state.formationChecklistItems.filter(
            (i) => i.id !== id,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "formation_checklist",
            entityId: id,
            entityName: existing.title,
            description: `Deleted formation checklist "${existing.title}"`,
          });
        }
      },
      getFormationChecklistItemById: (id) =>
        get().formationChecklistItems.find((i) => i.id === id),

      resetToSeed: () => {
        const hadActivity = get().activityLogs.length > 0;
        set({ ...createSeedData(), activityLogs: [], agentLogs: [], agentRuns: [] });
        if (hadActivity) {
          logActivity(set, get, {
            action: "reset",
            entityType: "system",
            entityName: "Demo data",
            description: "Reset all data to seed dataset",
          });
        }
      },

      exportSnapshotData: () => {
        const state = get();
        return buildSnapshot({
          profile: state.profile,
          projects: state.projects,
          tasks: state.tasks,
          agents: state.agents,
          transactions: state.transactions,
          documents: state.documents,
          ipAssets: state.ipAssets,
          decisions: state.decisions,
          roadmapItems: state.roadmapItems,
          entities: state.entities,
          activityLogs: state.activityLogs,
          workSessions: state.workSessions,
          inboxItems: state.inboxItems,
          founderNotes: state.founderNotes,
          complianceReminders: state.complianceReminders,
          legalQuestions: state.legalQuestions,
          formationChecklistItems: state.formationChecklistItems,
        });
      },

      importSnapshotData: (raw) => {
        const snapshot = parseSnapshot(raw);
        const normalized = normalizeOctaneData({
          profile: snapshot.profile,
          projects: snapshot.projects,
          tasks: snapshot.tasks,
          agents: snapshot.agents,
          transactions: snapshot.transactions,
          documents: snapshot.documents,
          ipAssets: snapshot.ipAssets,
          decisions: snapshot.decisions,
          roadmapItems: snapshot.roadmapItems,
          entities: snapshot.entities,
          activityLogs: snapshot.activityLogs,
          workSessions: snapshot.workSessions,
          inboxItems: snapshot.inboxItems,
          founderNotes: snapshot.founderNotes,
          complianceReminders: snapshot.complianceReminders,
          legalQuestions: snapshot.legalQuestions,
          formationChecklistItems: snapshot.formationChecklistItems,
        });
        set(normalized);
        logActivity(set, get, {
          action: "updated",
          entityType: "system",
          entityName: "Snapshot import",
          description: `Imported snapshot (${snapshot.dataSchemaVersion})`,
        });
      },

      clearLocalData: () => {
        const entry = createActivityLog({
          action: "reset",
          entityType: "system",
          entityName: "Local data",
          description: "Cleared all local workspace data",
        });
        set({ ...createSeedData(), activityLogs: [entry], agentLogs: [], agentRuns: [] });
      },

      clearToBlank: () => {
        set({
          ...createBlankState(),
          connections: createDefaultConnections(),
          octaneActions: [],
          projectConnections: [],
          agentLogs: [],
          agentRuns: [],
        });
      },

      createConnection: (data) => {
        const connection: Connection = {
          ...data,
          id: createId("conn"),
          ...timestamps(),
        };
        set((state) => ({
          connections: [...state.connections, connection],
        }));
        logActivity(set, get, {
          action: "created",
          entityType: "system",
          entityId: connection.id,
          entityName: connection.label,
          description: `Added connection "${connection.label}"`,
        });
        return connection;
      },
      updateConnection: (id, data) => {
        const existing = get().connections.find((c) => c.id === id);
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...data, ...touch() } : c,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "system",
            entityId: id,
            entityName: data.label ?? existing.label,
            description: `Updated connection "${data.label ?? existing.label}"`,
          });
        }
      },
      deleteConnection: (id) => {
        const existing = get().connections.find((c) => c.id === id);
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "deleted",
            entityType: "system",
            entityId: id,
            entityName: existing.label,
            description: `Removed connection "${existing.label}"`,
          });
        }
      },
      getConnectionById: (id) => get().connections.find((c) => c.id === id),

      proposeOctaneAction: (data) => {
        const action: OctaneAction = {
          ...data,
          id: createId("action"),
          status: "proposed",
          proposedAt: new Date().toISOString(),
        };
        set((state) => ({
          octaneActions: [action, ...state.octaneActions],
        }));
        logActivity(set, get, {
          action: "created",
          entityType: "system",
          entityId: action.id,
          entityName: action.title,
          description: `Proposed: ${action.title}`,
        });
        return action;
      },
      proposeOctaneActions: (items) =>
        items.map((item) => get().proposeOctaneAction(item)),

      approveOctaneAction: (id) => {
        const action = get().octaneActions.find((a) => a.id === id);
        if (!action || action.status !== "proposed") return;

        set((state) => ({
          octaneActions: state.octaneActions.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: "approved" as const,
                  resolvedAt: new Date().toISOString(),
                }
              : a,
          ),
        }));

        const approved = get().octaneActions.find((a) => a.id === id);
        if (!approved) return;

        const result = executeApprovedOctaneAction(get(), approved);
        if (result.ok) {
          get().completeOctaneAction(id);
        } else {
          get().failOctaneAction(id, result.error);
        }
      },
      rejectOctaneAction: (id) => {
        const existing = get().octaneActions.find((a) => a.id === id);
        set((state) => ({
          octaneActions: state.octaneActions.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: "rejected" as const,
                  resolvedAt: new Date().toISOString(),
                }
              : a,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "system",
            entityId: id,
            entityName: existing.title,
            description: `Rejected: ${existing.title}`,
          });
        }
      },
      completeOctaneAction: (id) => {
        const existing = get().octaneActions.find((a) => a.id === id);
        set((state) => ({
          octaneActions: state.octaneActions.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: "completed" as const,
                  resolvedAt: new Date().toISOString(),
                }
              : a,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "system",
            entityId: id,
            entityName: existing.title,
            description: `Completed: ${existing.title}`,
          });
        }
      },
      failOctaneAction: (id, errorMessage) => {
        const existing = get().octaneActions.find((a) => a.id === id);
        set((state) => ({
          octaneActions: state.octaneActions.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: "failed" as const,
                  errorMessage,
                  resolvedAt: new Date().toISOString(),
                }
              : a,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "system",
            entityId: id,
            entityName: existing.title,
            description: `Failed: ${existing.title} — ${errorMessage}`,
          });
        }
      },
      getOctaneActionById: (id) => get().octaneActions.find((a) => a.id === id),

      createProjectConnection: (data) => {
        const link: ProjectConnection = {
          ...data,
          id: createId("pconn"),
          ...timestamps(),
        };
        set((state) => ({
          projectConnections: [...state.projectConnections, link],
        }));
        logActivity(set, get, {
          action: "created",
          entityType: "project",
          entityId: data.projectId,
          entityName: link.label,
          description: `Linked ${link.kind} to project`,
        });
        return link;
      },
      updateProjectConnection: (id, data) => {
        const existing = get().projectConnections.find((pc) => pc.id === id);
        set((state) => ({
          projectConnections: state.projectConnections.map((pc) =>
            pc.id === id ? { ...pc, ...data, ...touch() } : pc,
          ),
        }));
        if (existing) {
          logActivity(set, get, {
            action: "updated",
            entityType: "project",
            entityId: existing.projectId,
            entityName: existing.label,
            description: `Updated ${existing.kind} link`,
          });
        }
      },
      deleteProjectConnection: (id) => {
        set((state) => ({
          projectConnections: state.projectConnections.filter((pc) => pc.id !== id),
        }));
      },
      getProjectConnectionsByProject: (projectId) =>
        get().projectConnections.filter((pc) => pc.projectId === projectId),

      recordActivity: (input) => {
        logActivity(set, get, input);
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state): OctanePersistedState => ({
        profile: state.profile,
        projects: state.projects,
        tasks: state.tasks,
        decisions: state.decisions,
        roadmapItems: state.roadmapItems,
        transactions: state.transactions,
        documents: state.documents,
        ipAssets: state.ipAssets,
        entities: state.entities,
        agents: state.agents,
        activityLogs: state.activityLogs,
        workSessions: state.workSessions,
        inboxItems: state.inboxItems,
        founderNotes: state.founderNotes,
        complianceReminders: state.complianceReminders,
        legalQuestions: state.legalQuestions,
        formationChecklistItems: state.formationChecklistItems,
        agentLogs: state.agentLogs,
        agentRuns: state.agentRuns,
        connections: state.connections,
        octaneActions: state.octaneActions,
        projectConnections: state.projectConnections,
      }),
      merge: (persisted, current) => {
        const persistedState = normalizePersistedState(
          persisted as Partial<OctanePersistedState> | undefined,
        );
        if (isPersistedStateEmpty(persistedState)) {
          return { ...current, ...normalizeOctaneData(createSeedData()) };
        }
        return {
          ...current,
          ...normalizeOctaneData({
            ...current,
            ...persistedState,
          }),
        };
      },
    },
  ),
);
