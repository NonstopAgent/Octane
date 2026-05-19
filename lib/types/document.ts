export type DocumentCategory =
  | "legal"
  | "financial"
  | "product"
  | "ip"
  | "contracts"
  | "brand"
  | "compliance"
  | "notes"
  | "other";

export type DocumentStatus =
  | "draft"
  | "active"
  | "archived"
  | "needs_review";

export interface Document {
  id: string;
  name: string;
  category: DocumentCategory;
  projectId?: string;
  status: DocumentStatus;
  tags: string[];
  notes?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}
