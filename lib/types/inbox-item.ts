export type InboxItemType =
  | "idea"
  | "task"
  | "decision"
  | "risk"
  | "note"
  | "document"
  | "finance"
  | "other";

export type InboxItemStatus = "unprocessed" | "converted" | "archived";

export interface InboxItem {
  id: string;
  title: string;
  body?: string;
  type: InboxItemType;
  status: InboxItemStatus;
  linkedProjectId?: string;
  createdAt: string;
  updatedAt: string;
}
