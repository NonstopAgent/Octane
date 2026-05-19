export type EntityType =
  | "trust"
  | "llc"
  | "lab"
  | "holding"
  | "subsidiary"
  | "other";

export type EntityStatus = "active" | "forming" | "inactive" | "dissolved";

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  status: EntityStatus;
  formationDate?: string;
  jurisdiction?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
