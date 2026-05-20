import Anthropic from "@anthropic-ai/sdk";

import { getFileContent } from "@/lib/integrations/github-write-client";
import type { CodingJobProposedEdit } from "@/lib/types/coding-job";

import { discoverSourceFiles } from "./discover-source-files";

const PREVIEW_CHARS = 480;

export type GenerateSourceEditsInput = {
  repo: string;
  prompt: string;
  planSummary?: string;
  files?: string[];
  ref?: string;
};

export type GenerateSourceEditsResult = {
  proposedFiles: string[];
  proposedEdits: CodingJobProposedEdit[];
  source: "anthropic" | "fallback";
  message?: string;
};

function preview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_CHARS) return trimmed;
  return `${trimmed.slice(0, PREVIEW_CHARS)}\n… (${trimmed.length} chars)`;
}

function decodeContent(raw: { content: string; encoding: string }): string {
  if (raw.encoding === "base64") {
    return Buffer.from(raw.content, "base64").toString("utf8");
  }
  return raw.content;
}

function parseEditsJson(text: string): { path: string; summary: string; content: string }[] | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as {
      edits?: { path?: string; summary?: string; content?: string }[];
    };
    if (!Array.isArray(raw.edits)) return null;
    return raw.edits
      .map((e) => ({
        path: String(e.path ?? "").replace(/\\/g, "/").replace(/^\//, ""),
        summary: String(e.summary ?? ""),
        content: String(e.content ?? ""),
      }))
      .filter((e) => e.path && e.content);
  } catch {
    return null;
  }
}

function buildFallbackEdits(
  files: string[],
  fileContents: Map<string, string>,
  prompt: string,
): CodingJobProposedEdit[] {
  return files.map((path) => {
    const before = fileContents.get(path) ?? "";
    const afterContent =
      before +
      `\n\n/* Octane fallback proposal — set ANTHROPIC_API_KEY for AI edits.\n` +
      `   Request: ${prompt.slice(0, 200).replace(/\*\//g, "")} */\n`;
    return {
      path,
      summary: "Placeholder edit (configure ANTHROPIC_API_KEY for real proposals)",
      beforePreview: preview(before),
      afterPreview: preview(afterContent),
      afterContent,
    };
  });
}

export async function generateSourceEdits(
  input: GenerateSourceEditsInput,
): Promise<GenerateSourceEditsResult> {
  const discovery = await discoverSourceFiles(
    input.repo,
    input.planSummary ? `${input.prompt}\n${input.planSummary}` : input.prompt,
  );
  const proposedFiles = (input.files?.length ? input.files : discovery.files).slice(0, 5);

  const ref = input.ref ?? discovery.branch ?? "main";
  const fileContents = new Map<string, string>();

  for (const path of proposedFiles) {
    const res = await getFileContent(input.repo, path, ref);
    if (res.ok && res.data) {
      fileContents.set(path, decodeContent(res.data));
    } else {
      fileContents.set(path, "");
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return {
      proposedFiles,
      proposedEdits: buildFallbackEdits(proposedFiles, fileContents, input.prompt),
      source: "fallback",
      message:
        discovery.message ??
        "ANTHROPIC_API_KEY not set — returning safe placeholder edits (no secrets, review before PR)",
    };
  }

  const filesBlock = proposedFiles
    .map((path) => {
      const content = fileContents.get(path) ?? "";
      return `### ${path}\n\`\`\`\n${content.slice(0, 12_000)}\n\`\`\``;
    })
    .join("\n\n");

  const client = new Anthropic({ apiKey });
  const system = `You are Octane's coding workbench. Output ONLY valid JSON:
{"edits":[{"path":"...","summary":"...","content":"full file after edit"}]}
Rules: max 5 files, minimal focused changes, no .env or secrets, no package-lock unless package.json also changes,
no deletions of entire files, no credentials. content must be the complete updated file.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system,
      messages: [
        {
          role: "user",
          content: `Repo: ${input.repo}\nRequest:\n${input.prompt}\n\nFiles:\n${filesBlock}`,
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");
    const parsed = parseEditsJson(text);
    if (parsed?.length) {
      const proposedEdits: CodingJobProposedEdit[] = parsed.slice(0, 5).map((e) => {
        const before = fileContents.get(e.path) ?? "";
        return {
          path: e.path,
          summary: e.summary || "Proposed change",
          beforePreview: preview(before),
          afterPreview: preview(e.content),
          afterContent: e.content,
        };
      });
      return {
        proposedFiles: proposedEdits.map((e) => e.path),
        proposedEdits,
        source: "anthropic",
      };
    }
  } catch {
    // fall through
  }

  return {
    proposedFiles,
    proposedEdits: buildFallbackEdits(proposedFiles, fileContents, input.prompt),
    source: "fallback",
    message: "AI parse failed — using safe fallback edits",
  };
}
