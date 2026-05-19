import { useOctaneStore } from "@/lib/store/octane-store";
import type { Entity } from "@/lib/types";

type CreatableEntity = Omit<Entity, "id" | "createdAt" | "updatedAt">;

export async function getEntities(): Promise<Entity[]> {
  return useOctaneStore.getState().entities;
}

export async function getEntityById(id: string): Promise<Entity | undefined> {
  return useOctaneStore.getState().getEntityById(id);
}

export async function createEntity(data: CreatableEntity): Promise<Entity> {
  return useOctaneStore.getState().createEntity(data);
}

export async function updateEntity(
  id: string,
  data: Partial<Entity>,
): Promise<void> {
  useOctaneStore.getState().updateEntity(id, data);
}

export async function deleteEntity(id: string): Promise<void> {
  useOctaneStore.getState().deleteEntity(id);
}
