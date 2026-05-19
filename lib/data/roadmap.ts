import { useOctaneStore } from "@/lib/store/octane-store";
import type { RoadmapItem } from "@/lib/types";

type CreatableRoadmapItem = Omit<
  RoadmapItem,
  "id" | "createdAt" | "updatedAt"
>;

export async function getRoadmapItems(): Promise<RoadmapItem[]> {
  return useOctaneStore.getState().roadmapItems;
}

export async function getRoadmapItemById(
  id: string,
): Promise<RoadmapItem | undefined> {
  return useOctaneStore.getState().getRoadmapItemById(id);
}

export async function createRoadmapItem(
  data: CreatableRoadmapItem,
): Promise<RoadmapItem> {
  return useOctaneStore.getState().createRoadmapItem(data);
}

export async function updateRoadmapItem(
  id: string,
  data: Partial<RoadmapItem>,
): Promise<void> {
  useOctaneStore.getState().updateRoadmapItem(id, data);
}

export async function deleteRoadmapItem(id: string): Promise<void> {
  useOctaneStore.getState().deleteRoadmapItem(id);
}
