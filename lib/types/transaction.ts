export type TransactionType =
  | "revenue"
  | "expense"
  | "investment"
  | "software"
  | "contractor"
  | "legal"
  | "other";

export type TransactionCadence = "monthly" | "yearly";

export interface Transaction {
  id: string;
  projectId?: string;
  type: TransactionType;
  amount: number;
  category?: string;
  notes?: string;
  transactionDate: string;
  createdAt: string;
  /** Set when CSV import flags spend above 2.5× projected monthly burn. */
  anomaly?: boolean;
  /** Ongoing commitment (subscription/retainer) — powers recurring-cost views. */
  recurring?: boolean;
  /** Billing cadence for recurring transactions (default monthly). */
  cadence?: TransactionCadence;
}
