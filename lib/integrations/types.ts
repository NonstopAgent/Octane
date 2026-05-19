export type IntegrationProvider = "github" | "vercel";

export type IntegrationAuthStatus = {
  provider: IntegrationProvider;
  configured: boolean;
  connected: boolean;
  message?: string;
  login?: string;
  name?: string;
  teamId?: string;
  checkedAt: string;
};

export type GitHubRepoSummary = {
  fullName: string;
  name: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  openIssues: number;
  stars: number;
  pushedAt: string | null;
  url: string;
};

export type GitHubCommitSummary = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

export type GitHubIssueSummary = {
  number: number;
  title: string;
  url: string;
  author: string;
  labels: string[];
  createdAt: string;
};

export type GitHubPullRequestSummary = {
  number: number;
  title: string;
  url: string;
  author: string;
  createdAt: string;
};

export type GitHubRepoDetail = GitHubRepoSummary & {
  forks: number;
  language: string | null;
  visibility: string;
};

export type VercelProjectSummary = {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: string | null;
  url: string | null;
};

export type VercelDeploymentSummary = {
  id: string;
  name: string;
  url: string | null;
  state: string;
  readyState?: string;
  createdAt: string;
  target?: string;
};

export type VercelProjectDetail = VercelProjectSummary & {
  link?: string;
  latestDeployment?: VercelDeploymentSummary | null;
};
