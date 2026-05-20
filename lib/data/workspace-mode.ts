import { PROJECT_IDS, seedProfile, seedProjects } from "@/lib/mock/seed";
import type { OctanePersistedState } from "@/lib/store/octane-store";

export type WorkspaceDataMode = "demo_seed" | "real_workspace" | "mixed";

export type WorkspaceDataModeInfo = {
  mode: WorkspaceDataMode;
  label: string;
  description: string;
  /** Portfolio rows match bundled seed IDs and count. */
  seedPortfolio: boolean;
  /** Founder profile still matches seed defaults. */
  seedProfile: boolean;
  /** User-linked GitHub/Vercel project connections (not seed placeholders). */
  hasLinkedIntegrations: boolean;
};

const SEED_PROJECT_ID_SET = new Set<string>(Object.values(PROJECT_IDS));

export function detectWorkspaceDataMode(
  state: Pick<
    OctanePersistedState,
    "profile" | "projects" | "projectConnections"
  >,
): WorkspaceDataModeInfo {
  const seedPortfolio =
    state.projects.length > 0 &&
    state.projects.length === seedProjects.length &&
    state.projects.every((p) => SEED_PROJECT_ID_SET.has(p.id));

  const profileMatchesSeed =
    state.profile.id === seedProfile.id &&
    state.profile.email === seedProfile.email &&
    state.profile.name === seedProfile.name;

  const hasLinkedIntegrations = state.projectConnections.some(
    (pc) =>
      pc.status === "linked" &&
      ((pc.kind === "github" && Boolean(pc.repo)) ||
        (pc.kind === "vercel" && Boolean(pc.label?.trim()))),
  );

  let mode: WorkspaceDataMode;
  if (seedPortfolio && profileMatchesSeed && !hasLinkedIntegrations) {
    mode = "demo_seed";
  } else if (!seedPortfolio && !profileMatchesSeed) {
    mode = "real_workspace";
  } else if (seedPortfolio && profileMatchesSeed && hasLinkedIntegrations) {
    mode = "mixed";
  } else if (!seedPortfolio || !profileMatchesSeed) {
    mode = hasLinkedIntegrations ? "mixed" : "real_workspace";
  } else {
    mode = "mixed";
  }

  const label =
    mode === "demo_seed"
      ? "Demo seed"
      : mode === "real_workspace"
        ? "Real workspace"
        : "Mixed";

  const description =
    mode === "demo_seed"
      ? "Portfolio matches the bundled Octane demo. GitHub/Vercel links and server tokens add live data on top."
      : mode === "real_workspace"
        ? "Projects and profile differ from the demo seed — treat metrics as your workspace."
        : "Demo portfolio with live integration links or customized profile — verify which rows are seed vs linked.";

  return {
    mode,
    label,
    description,
    seedPortfolio,
    seedProfile: profileMatchesSeed,
    hasLinkedIntegrations,
  };
}
