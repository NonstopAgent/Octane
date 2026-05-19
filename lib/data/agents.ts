import { useOctaneStore } from "@/lib/store/octane-store";
import type { Agent } from "@/lib/types";

type CreatableAgent = Omit<Agent, "id" | "createdAt" | "updatedAt">;

export async function getAgents(): Promise<Agent[]> {
  return useOctaneStore.getState().agents;
}

export async function getAgentById(id: string): Promise<Agent | undefined> {
  return useOctaneStore.getState().getAgentById(id);
}

export async function createAgent(data: CreatableAgent): Promise<Agent> {
  return useOctaneStore.getState().createAgent(data);
}

export async function updateAgent(
  id: string,
  data: Partial<Agent>,
): Promise<void> {
  useOctaneStore.getState().updateAgent(id, data);
}

export async function deleteAgent(id: string): Promise<void> {
  useOctaneStore.getState().deleteAgent(id);
}
