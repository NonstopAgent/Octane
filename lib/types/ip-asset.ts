export type IPAssetType =
  | "software"
  | "brand"
  | "domain"
  | "content"
  | "dataset"
  | "strategy"
  | "document";

export type IPProtectionStatus =
  | "unprotected"
  | "in_progress"
  | "registered"
  | "licensed";

export interface IPAsset {
  id: string;
  name: string;
  type: IPAssetType;
  ownerEntity: string;
  projectId?: string;
  protectionStatus: IPProtectionStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
