import type { Transaction, TransactionType } from "@/lib/types";

export type CreatableTransaction = Omit<Transaction, "id" | "createdAt">;

export type CsvImportResult = {
  added: number;
  skippedDuplicates: number;
  errors: string[];
};

export type FinanceCsvRow = {
  date: string;
  type: string;
  project: string;
  amount: number;
  notes: string;
};

const REQUIRED_HEADERS = ["date", "type", "project", "amount", "notes"] as const;

const PROJECT_ALIASES: { pattern: RegExp; name: string }[] = [
  { pattern: /\bajax\b/i, name: "Octane Ajax" },
  { pattern: /\bnexus\b/i, name: "Octane Nexus" },
  { pattern: /\b(octane\s+core|core)\b/i, name: "Octane Core" },
];

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, "");
}

export function parseFinanceCsv(text: string): {
  rows: FinanceCsvRow[];
  errors: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errors: string[] = [];
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV needs a header row and at least one data row."] };
  }

  const headerCells = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const headerMap = new Map(
    headerCells.map((h, i) => [normalizeHeader(h), i] as const),
  );

  for (const required of REQUIRED_HEADERS) {
    if (!headerMap.has(required)) {
      errors.push(`Missing column: ${required}`);
    }
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: FinanceCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (key: (typeof REQUIRED_HEADERS)[number]) =>
      cells[headerMap.get(key)!]?.trim().replace(/^"|"$/g, "") ?? "";

    const amountRaw = get("amount").replace(/[$,]/g, "");
    const amount = Number.parseFloat(amountRaw);
    if (Number.isNaN(amount)) {
      errors.push(`Row ${i + 1}: invalid amount "${get("amount")}"`);
      continue;
    }

    rows.push({
      date: get("date"),
      type: get("type"),
      project: get("project"),
      amount,
      notes: get("notes"),
    });
  }

  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function fuzzyMatchProjectId(
  projectLabel: string,
  projects: { id: string; name: string }[],
): string | undefined {
  const label = projectLabel.trim();
  if (!label) return undefined;

  const exact = projects.find(
    (p) => p.name.toLowerCase() === label.toLowerCase(),
  );
  if (exact) return exact.id;

  for (const { pattern, name } of PROJECT_ALIASES) {
    if (pattern.test(label)) {
      const match = projects.find((p) => p.name === name);
      if (match) return match.id;
    }
  }

  const partial = projects.find((p) =>
    label.toLowerCase().includes(p.name.toLowerCase().split(" ").pop() ?? ""),
  );
  return partial?.id;
}

export function mapCsvTypeToTransactionType(raw: string): TransactionType {
  const t = raw.trim().toLowerCase();
  if (t === "revenue" || t === "income") return "revenue";
  if (t === "investment" || t === "capital") return "investment";
  if (t === "software" || t === "saas") return "software";
  if (t === "contractor") return "contractor";
  if (t === "legal") return "legal";
  if (t === "expense" || t === "cost") return "expense";
  return "other";
}

export function signedAmountForType(
  type: TransactionType,
  amount: number,
): number {
  const expenseTypes: TransactionType[] = [
    "expense",
    "software",
    "contractor",
    "legal",
    "other",
  ];
  if (type === "revenue" || type === "investment") return Math.abs(amount);
  if (expenseTypes.includes(type)) return -Math.abs(amount);
  return amount;
}

/** Deterministic key for CSV / ledger deduplication. */
export function transactionDedupeKey(
  transactionDate: string,
  amount: number,
  type: TransactionType,
  projectId?: string,
): string {
  return `${transactionDate}|${amount}|${type}|${projectId ?? ""}`;
}

export function buildExistingTransactionDedupeKeys(
  transactions: Transaction[],
): Set<string> {
  const keys = new Set<string>();
  for (const t of transactions) {
    keys.add(
      transactionDedupeKey(
        t.transactionDate,
        t.amount,
        t.type,
        t.projectId,
      ),
    );
  }
  return keys;
}

/**
 * Import parsed CSV rows into the ledger, skipping duplicates that match
 * transactionDate + amount + type + projectId.
 */
export function importFinanceCsvRows(
  rows: FinanceCsvRow[],
  options: {
    projects: { id: string; name: string }[];
    existingTransactions: Transaction[];
    createTransaction: (data: CreatableTransaction) => Transaction;
  },
): CsvImportResult {
  const { projects, existingTransactions, createTransaction } = options;
  const seen = buildExistingTransactionDedupeKeys(existingTransactions);
  let added = 0;
  let skippedDuplicates = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type = mapCsvTypeToTransactionType(row.type);
    const projectId = fuzzyMatchProjectId(row.project, projects);
    const amount = signedAmountForType(type, row.amount);
    const key = transactionDedupeKey(row.date, amount, type, projectId);

    if (seen.has(key)) {
      skippedDuplicates += 1;
      continue;
    }

    try {
      createTransaction({
        type,
        amount,
        category: row.type,
        notes: row.notes || undefined,
        transactionDate: row.date,
        projectId,
      });
      seen.add(key);
      added += 1;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create transaction";
      errors.push(`Row ${i + 2}: ${message}`);
    }
  }

  return { added, skippedDuplicates, errors };
}
