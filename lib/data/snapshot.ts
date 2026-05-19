import { appVersion, dataSchemaVersion } from "@/lib/version";
import type {
  ActivityLog,
  Agent,
  Decision,
  Document,
  Entity,
  FounderNote,
  InboxItem,
  IPAsset,
  Profile,
  Project,
  RoadmapItem,
  Task,
  Transaction,
  WorkSession,
} from "@/lib/types";

export interface OctaneSnapshot {
  profile: Profile;
  projects: Project[];
  tasks: Task[];
  agents: Agent[];
  transactions: Transaction[];
  documents: Document[];
  ipAssets: IPAsset[];
  decisions: Decision[];
  roadmapItems: RoadmapItem[];
  entities: Entity[];
  activityLogs: ActivityLog[];
  workSessions: WorkSession[];
  inboxItems: InboxItem[];
  founderNotes: FounderNote[];
  generatedAt: string;
  appVersion: string;
  dataSchemaVersion: string;
}

const SNAPSHOT_ARRAY_KEYS = [
  "projects",
  "tasks",
  "agents",
  "transactions",
  "documents",
  "ipAssets",
  "decisions",
  "roadmapItems",
  "entities",
  "activityLogs",
  "workSessions",
  "inboxItems",
  "founderNotes",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertArray(
  data: Record<string, unknown>,
  key: (typeof SNAPSHOT_ARRAY_KEYS)[number],
  errors: string[],
): void {
  const value = data[key];
  if (value === undefined) {
    errors.push(`Missing required field "${key}" (expected an array).`);
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`"${key}" must be an array.`);
  }
}

function validateSnapshotShape(data: unknown): asserts data is OctaneSnapshot {
  const errors: string[] = [];

  if (!isRecord(data)) {
    throw new Error("Snapshot must be a JSON object.");
  }

  if (!isRecord(data.profile)) {
    errors.push('Missing or invalid "profile" (expected an object).');
  }

  for (const key of SNAPSHOT_ARRAY_KEYS) {
    assertArray(data, key, errors);
  }

  if (typeof data.generatedAt !== "string" || !data.generatedAt) {
    errors.push('Missing or invalid "generatedAt" (expected a non-empty string).');
  }

  if (typeof data.appVersion !== "string" || !data.appVersion) {
    errors.push('Missing or invalid "appVersion" (expected a non-empty string).');
  }

  if (typeof data.dataSchemaVersion !== "string" || !data.dataSchemaVersion) {
    errors.push(
      'Missing or invalid "dataSchemaVersion" (expected a non-empty string).',
    );
  }

  if (errors.length > 0) {
    throw new Error(`Invalid snapshot:\n${errors.map((e) => `• ${e}`).join("\n")}`);
  }
}

export function exportSnapshotData(state: Omit<OctaneSnapshot, "generatedAt" | "appVersion" | "dataSchemaVersion">): OctaneSnapshot {
  return {
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
    generatedAt: new Date().toISOString(),
    appVersion,
    dataSchemaVersion,
  };
}

export function importSnapshotData(raw: unknown): OctaneSnapshot {
  let parsed: unknown = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new Error("Snapshot must be valid JSON.");
    }
  }

  validateSnapshotShape(parsed);
  return parsed;
}
