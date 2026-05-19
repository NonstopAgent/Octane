import type { ProjectPriority } from "./project";

export type RoadmapTimeframe = "now" | "next" | "later" | "someday";

export type RoadmapItemStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  projectId?: string;
  timeframe: RoadmapTimeframe;
  priority: ProjectPriority;
  targetDate?: string;
  status: RoadmapItemStatus;
  dependencies: string[];
  expectedImpact?: string;
  difficulty?: "easy" | "medium" | "hard";
  createdAt: string;
  updatedAt: string;
}
