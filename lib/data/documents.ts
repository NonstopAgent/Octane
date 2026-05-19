import { useOctaneStore } from "@/lib/store/octane-store";
import type { Document } from "@/lib/types";

type CreatableDocument = Omit<Document, "id" | "createdAt" | "updatedAt">;

export async function getDocuments(): Promise<Document[]> {
  return useOctaneStore.getState().documents;
}

export async function getDocumentById(
  id: string,
): Promise<Document | undefined> {
  return useOctaneStore.getState().getDocumentById(id);
}

export async function createDocument(
  data: CreatableDocument,
): Promise<Document> {
  return useOctaneStore.getState().createDocument(data);
}

export async function updateDocument(
  id: string,
  data: Partial<Document>,
): Promise<void> {
  useOctaneStore.getState().updateDocument(id, data);
}

export async function deleteDocument(id: string): Promise<void> {
  useOctaneStore.getState().deleteDocument(id);
}
