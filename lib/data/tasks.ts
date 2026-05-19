import { useOctaneStore } from "@/lib/store/octane-store";
import type { Task, TaskStatus } from "@/lib/types";

type CreatableTask = Omit<Task, "id" | "createdAt" | "updatedAt">;

export async function getTasks(): Promise<Task[]> {
  return useOctaneStore.getState().tasks;
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  return useOctaneStore.getState().getTaskById(id);
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  return useOctaneStore.getState().getTasksByProject(projectId);
}

export async function createTask(data: CreatableTask): Promise<Task> {
  return useOctaneStore.getState().createTask(data);
}

export async function updateTask(
  id: string,
  data: Partial<Task>,
): Promise<void> {
  useOctaneStore.getState().updateTask(id, data);
}

export async function deleteTask(id: string): Promise<void> {
  useOctaneStore.getState().deleteTask(id);
}

export async function moveTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<void> {
  useOctaneStore.getState().moveTaskStatus(id, status);
}
