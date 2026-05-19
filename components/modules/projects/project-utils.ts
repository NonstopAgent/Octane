import { formatDistanceToNow } from "date-fns";

import type {
  ProjectPriority,
  ProjectRevenueStatus,
  ProjectStatus,
} from "@/lib/types";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "idea",
  "building",
  "testing",
  "launched",
  "paused",
  "killed",
];

export const PROJECT_PRIORITIES: ProjectPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const REVENUE_STATUSES: ProjectRevenueStatus[] = [
  "none",
  "pre_revenue",
  "early_revenue",
  "recurring",
  "profitable",
];

export function formatRevenueStatus(status: ProjectRevenueStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatUpdatedAt(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listToLines(items?: string[]): string {
  return items?.join("\n") ?? "";
}
