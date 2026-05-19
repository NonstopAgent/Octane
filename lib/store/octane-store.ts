import { create } from "zustand";
import { persist } from "zustand/middleware";

import { seedData } from "@/lib/mock/seed";
import type {
  Agent,
  Decision,
  Document,
  Entity,
  IPAsset,
  Profile,
  Project,
  RoadmapItem,
  Task,
  TaskStatus,
  Transaction,
} from "@/lib/types";

import type { ActivityLog } from "@/lib/types/activity-log";

import { prependActivityLog, type ActivityLogInput } from "./activity";
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

  // Profile
  updateProfile: (data: Partial<Profile>) => void;

  // Bulk
  resetToSeed: () => void;
}

const STORAGE_KEY = "octane-core-storage";

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

export const useOctaneStore = create<OctaneStore>()(
  persist(
    (set, get) => ({
      ...seedData,

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
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status, ...touch() } : t,
          ),
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
        set((state) => ({
          decisions: state.decisions.map((d) =>
            d.id === id ? { ...d, ...data, ...touch() } : d,
          ),
        }));
      },
      deleteDecision: (id) => {
        set((state) => ({
          decisions: state.decisions.filter((d) => d.id !== id),
        }));
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
        return asset;
      },
      updateIPAsset: (id, data) => {
        set((state) => ({
          ipAssets: state.ipAssets.map((a) =>
            a.id === id ? { ...a, ...data, ...touch() } : a,
          ),
        }));
      },
      deleteIPAsset: (id) => {
        set((state) => ({
          ipAssets: state.ipAssets.filter((a) => a.id !== id),
        }));
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

      updateProfile: (data) => {
        set((state) => ({
          profile: { ...state.profile, ...data },
        }));
      },

      resetToSeed: () => {
        set({ ...seedData, activityLogs: [] });
        logActivity(set, get, {
          action: "reset",
          entityType: "system",
          entityId: "demo",
          entityName: "Demo data",
          description: "Reset all data to seed dataset",
        });
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
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as
          | Partial<OctanePersistedState>
          | undefined;
        if (isPersistedStateEmpty(persistedState)) {
          return { ...current, ...seedData };
        }
        return {
          ...current,
          ...persistedState,
          activityLogs: persistedState?.activityLogs ?? [],
        };
      },
    },
  ),
);
