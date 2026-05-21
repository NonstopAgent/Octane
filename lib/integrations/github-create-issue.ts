import { fetchWithTimeout } from "@/lib/integrations/http";

export type CreateGitHubIssueInput = {
  repo: string;
  title: string;
  body: string;
  labels?: string[];
};

export type CreateGitHubIssueResult =
  | { ok: true; number: number; url: string }
  | { ok: false; error: string };

/** Server-only — requires GITHUB_TOKEN. */
export async function createGitHubIssue(
  input: CreateGitHubIssueInput,
): Promise<CreateGitHubIssueResult> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "GITHUB_TOKEN not configured on server" };
  }

  const encoded = input.repo
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");

  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${encoded}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        labels: input.labels ?? [],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      error: text || `GitHub API error ${res.status}`,
    };
  }

  const data = (await res.json()) as { number: number; html_url: string };
  return { ok: true, number: data.number, url: data.html_url };
}
