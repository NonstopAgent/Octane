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
  /** Target owner once structure is finalized (gap when different from ownerEntity). */
  intendedOwnerEntity?: string;
  projectId?: string;
  protectionStatus: IPProtectionStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
