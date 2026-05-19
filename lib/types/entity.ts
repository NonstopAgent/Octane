export type EntityType =
  | "trust"
  | "llc"
  | "lab"
  | "holding"
  | "subsidiary"
  | "product"
  | "other";

export type EntityStatus = "active" | "forming" | "inactive" | "dissolved";

export interface Entity {
  id: string;
  name: string;
  tagline?: string;
  logoEmoji?: string;
  type: EntityType;
  status: EntityStatus;
  formationDate?: string;
  jurisdiction?: string;
  notes?: string;
  // Integrations
  githubRepo?: string;        // "owner/repo" format
  vercelProjectId?: string;   // Vercel project ID
  websiteUrl?: string;
  // Linked data
  linkedProjectIds?: string[]; // project IDs that belong to this entity
  createdAt: string;
  updatedAt: string;
}
