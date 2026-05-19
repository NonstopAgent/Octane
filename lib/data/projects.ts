import { useOctaneStore } from "@/lib/store/octane-store";
import type { Project } from "@/lib/types";

type CreatableProject = Omit<Project, "id" | "createdAt" | "updatedAt">;

export async function getProjects(): Promise<Project[]> {
  return useOctaneStore.getState().projects;
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return useOctaneStore.getState().getProjectById(id);
}

export async function createProject(
  data: CreatableProject,
): Promise<Project> {
  return useOctaneStore.getState().createProject(data);
}

export async function updateProject(
  id: string,
  data: Partial<Project>,
): Promise<void> {
  useOctaneStore.getState().updateProject(id, data);
}

export async function deleteProject(id: string): Promise<void> {
  useOctaneStore.getState().deleteProject(id);
}
