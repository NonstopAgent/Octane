export type ProjectConnectionKind =
  | "github"
  | "vercel"
  | "supabase"
  | "website"
  | "cursor";

export type ProjectConnectionStatus = "linked" | "pending" | "placeholder";

export interface ProjectConnection {
  id: string;
  projectId: string;
  kind: ProjectConnectionKind;
  label: string;
  url?: string;
  repo?: string;
  status: ProjectConnectionStatus;
  createdAt: string;
  updatedAt: string;
}
