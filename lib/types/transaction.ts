export type TransactionType =
  | "revenue"
  | "expense"
  | "investment"
  | "software"
  | "contractor"
  | "legal"
  | "other";

export interface Transaction {
  id: string;
  projectId?: string;
  type: TransactionType;
  amount: number;
  category?: string;
  notes?: string;
  transactionDate: string;
  createdAt: string;
}
