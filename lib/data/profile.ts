import { useOctaneStore } from "@/lib/store/octane-store";
import type { Profile } from "@/lib/types";

export async function getProfile(): Promise<Profile> {
  return useOctaneStore.getState().profile;
}

export async function updateProfile(data: Partial<Profile>): Promise<void> {
  useOctaneStore.getState().updateProfile(data);
}
