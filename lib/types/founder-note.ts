export interface FounderNote {
  id: string;
  title: string;
  body: string;
  linkedProjectId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
