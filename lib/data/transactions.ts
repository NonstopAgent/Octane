import { useOctaneStore } from "@/lib/store/octane-store";
import type { Transaction } from "@/lib/types";

type CreatableTransaction = Omit<Transaction, "id" | "createdAt">;

export async function getTransactions(): Promise<Transaction[]> {
  return useOctaneStore.getState().transactions;
}

export async function getTransactionById(
  id: string,
): Promise<Transaction | undefined> {
  return useOctaneStore.getState().getTransactionById(id);
}

export async function createTransaction(
  data: CreatableTransaction,
): Promise<Transaction> {
  return useOctaneStore.getState().createTransaction(data);
}

export async function updateTransaction(
  id: string,
  data: Partial<Transaction>,
): Promise<void> {
  useOctaneStore.getState().updateTransaction(id, data);
}

export async function deleteTransaction(id: string): Promise<void> {
  useOctaneStore.getState().deleteTransaction(id);
}
