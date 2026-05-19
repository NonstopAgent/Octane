import { useOctaneStore } from "@/lib/store/octane-store";
import type { IPAsset } from "@/lib/types";

type CreatableIPAsset = Omit<IPAsset, "id" | "createdAt" | "updatedAt">;

export async function getIPAssets(): Promise<IPAsset[]> {
  return useOctaneStore.getState().ipAssets;
}

export async function getIPAssetById(id: string): Promise<IPAsset | undefined> {
  return useOctaneStore.getState().getIPAssetById(id);
}

export async function createIPAsset(data: CreatableIPAsset): Promise<IPAsset> {
  return useOctaneStore.getState().createIPAsset(data);
}

export async function updateIPAsset(
  id: string,
  data: Partial<IPAsset>,
): Promise<void> {
  useOctaneStore.getState().updateIPAsset(id, data);
}

export async function deleteIPAsset(id: string): Promise<void> {
  useOctaneStore.getState().deleteIPAsset(id);
}
