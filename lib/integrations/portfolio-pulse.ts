import {
  getOpenIssues,
  getOpenPullRequests,
  getRecentCommits,
  getRepo,
} from "@/lib/integrations/github-client";

export const PORTFOLIO_REPOS = [
  { anchor: "Ajax" as const, fullName: "NonstopAgent/Octane-Ajax" },
  { anchor: "Nexus" as const, fullName: "NonstopAgent/Octane-Nexus" },
  { anchor: "Core" as const, fullName: "NonstopAgent/Octane" },
] as const;

export type PortfolioAnchor = (typeof PORTFOLIO_REPOS)[number]["anchor"];

export type PortfolioPulseEventType = "commit" | "pull_request" | "issue";

export type PortfolioPulseEvent = {
  id: string;
  anchor: PortfolioAnchor;
  repo: string;
  type: PortfolioPulseEventType;
  title: string;
  subtitle?: string;
  url?: string;
  occurredAt: string;
};

export type PortfolioRepoPulse = {
  anchor: PortfolioAnchor;
  repo: string;
  configured: boolean;
  openIssues: number;
  openPRs: number;
  pushedAt: string | null;
  events: PortfolioPulseEvent[];
};

export type PortfolioPulseResult = {
  configured: boolean;
  checkedAt: string;
  repos: PortfolioRepoPulse[];
};

export async function fetchPortfolioPulse(): Promise<PortfolioPulseResult> {
  const configured = Boolean(process.env.GITHUB_TOKEN?.trim());
  const checkedAt = new Date().toISOString();

  const repos = await Promise.all(
    PORTFOLIO_REPOS.map(async ({ anchor, fullName }) => {
      if (!configured) {
        return {
          anchor,
          repo: fullName,
          configured: false,
          openIssues: 0,
          openPRs: 0,
          pushedAt: null,
          events: [] as PortfolioPulseEvent[],
        };
      }

      const [repoMeta, commits, issues, prs] = await Promise.all([
        getRepo(fullName),
        getRecentCommits(fullName, 5),
        getOpenIssues(fullName, 5),
        getOpenPullRequests(fullName, 5),
      ]);

      const events: PortfolioPulseEvent[] = [];

      for (const c of commits) {
        events.push({
          id: `${anchor}-commit-${c.sha}`,
          anchor,
          repo: fullName,
          type: "commit",
          title: c.message,
          subtitle: `${c.author} · ${c.shortSha}`,
          url: c.url,
          occurredAt: c.date,
        });
      }

      for (const pr of prs) {
        events.push({
          id: `${anchor}-pr-${pr.number}`,
          anchor,
          repo: fullName,
          type: "pull_request",
          title: pr.title,
          subtitle: `PR #${pr.number} · ${pr.author}`,
          url: pr.url,
          occurredAt: pr.createdAt,
        });
      }

      for (const issue of issues) {
        events.push({
          id: `${anchor}-issue-${issue.number}`,
          anchor,
          repo: fullName,
          type: "issue",
          title: issue.title,
          subtitle: `Issue #${issue.number}${issue.labels.length ? ` · ${issue.labels.slice(0, 2).join(", ")}` : ""}`,
          url: issue.url,
          occurredAt: issue.createdAt,
        });
      }

      events.sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );

      return {
        anchor,
        repo: fullName,
        configured: true,
        openIssues: repoMeta?.openIssues ?? issues.length,
        openPRs: prs.length,
        pushedAt: repoMeta?.pushedAt ?? null,
        events: events.slice(0, 12),
      };
    }),
  );

  return { configured, checkedAt, repos };
}
