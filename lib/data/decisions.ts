import { useOctaneStore } from "@/lib/store/octane-store";
import type { Decision } from "@/lib/types";

type CreatableDecision = Omit<Decision, "id" | "createdAt" | "updatedAt">;

export async function getDecisions(): Promise<Decision[]> {
  return useOctaneStore.getState().decisions;
}

export async function getDecisionById(
  id: string,
): Promise<Decision | undefined> {
  return useOctaneStore.getState().getDecisionById(id);
}

export async function createDecision(
  data: CreatableDecision,
): Promise<Decision> {
  return useOctaneStore.getState().createDecision(data);
}

export async function updateDecision(
  id: string,
  data: Partial<Decision>,
): Promise<void> {
  useOctaneStore.getState().updateDecision(id, data);
}

export async function deleteDecision(id: string): Promise<void> {
  useOctaneStore.getState().deleteDecision(id);
}
