import { fuzzyMatchProjectId } from "@/lib/finance/csv-import";
import type { GmailMessage, GmailSignalClass } from "@/lib/types/gmail-message";
import type { Signal, SignalSeverity, SignalType } from "@/lib/types/signal";

export type GmailNormalizeContext = {
  projects?: { id: string; name: string }[];
  entities?: {
    id: string;
    name: string;
    linkedProjectIds?: string[];
  }[];
};

const PORTFOLIO_SLUGS: { pattern: RegExp; name: string }[] = [
  { pattern: /\b(octane\s+ajax|ajax)\b/i, name: "Octane Ajax" },
  { pattern: /\b(octane\s+nexus|nexus)\b/i, name: "Octane Nexus" },
  { pattern: /\b(octane\s+core|octane-core)\b/i, name: "Octane Core" },
];

function messageBlob(msg: GmailMessage): string {
  return `${msg.subject} ${msg.snippet} ${msg.from}`.toLowerCase();
}

function classifyMessage(msg: GmailMessage): GmailSignalClass {
  if (msg.signalClass) return msg.signalClass;
  const blob = messageBlob(msg);

  if (
    /\b(invoice|payment|billing|stripe|subscription|receipt|refund|charge|past due|operating\s+cost)\b/.test(
      blob,
    )
  ) {
    return "finance";
  }

  if (
    /\b(hosting|vercel|aws|infrastructure|operating\s+cost)\b/.test(blob) &&
    /\b(\$|invoice|charge|billing)\b/.test(blob)
  ) {
    return "finance";
  }

  if (
    /\b(failed build|build failed|deployment failed|deploy failed|failed deploy)\b/.test(
      blob,
    )
  ) {
    return "risk";
  }

  if (
    /\b(alert|security|vulnerab|dependabot|breach|compromise|unauthorized|2fa|phishing)\b/.test(
      blob,
    )
  ) {
    return "risk";
  }

  if (/\b(failed|error|down|outage|incident|exception|critical)\b/.test(blob)) {
    return "risk";
  }

  if (
    /\b(pilot|partnership|interest|demo|opportunity|intro|meeting request)\b/.test(
      blob,
    )
  ) {
    return "opportunity";
  }

  return "action";
}

function signalTypeFromClass(cls: GmailSignalClass): SignalType {
  switch (cls) {
    case "finance":
      return "cost";
    case "risk":
      return "risk";
    case "opportunity":
      return "opportunity";
    case "action":
    default:
      return "approval";
  }
}

function severityFromClass(cls: GmailSignalClass, blob: string): SignalSeverity {
  if (cls === "risk") {
    if (
      /\b(critical|breach|compromise|failed build|deployment failed|security alert|exception)\b/.test(
        blob,
      )
    ) {
      return "critical";
    }
    if (/\b(alert|security|failed|error|urgent|dependabot)\b/.test(blob)) {
      return "high";
    }
    return "high";
  }
  if (cls === "finance") {
    if (/\b(past due|failed payment|declined|overdue)\b/.test(blob)) {
      return "critical";
    }
    if (/\b(invoice|payment|billing|hosting)\b/.test(blob)) {
      return "high";
    }
    return "medium";
  }
  if (cls === "action") {
    if (/\b(action required|failed build|deployment failed|urgent)\b/.test(blob)) {
      return "high";
    }
    return "medium";
  }
  return "low";
}

function extractDollarAmounts(text: string): number[] {
  const amounts: number[] = [];
  for (const match of text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)) {
    const parsed = Number.parseFloat(match[1].replace(/,/g, ""));
    if (!Number.isNaN(parsed)) amounts.push(parsed);
  }
  return amounts;
}

function extractCriticalSnippet(blob: string, maxLen = 120): string | undefined {
  const patterns = [
    /\b(critical[^.]{0,80})/i,
    /\b(exception[^.]{0,80})/i,
    /\b(deployment failed[^.]{0,80})/i,
    /\b(build failed[^.]{0,80})/i,
    /\b(action required[^.]{0,80})/i,
  ];
  for (const pattern of patterns) {
    const m = blob.match(pattern);
    if (m?.[0]) return m[0].trim().slice(0, maxLen);
  }
  return undefined;
}

export type GmailEnrichedMetadata = {
  portfolioKeywords: string[];
  invoiceBalance?: number;
  hostingAmount?: number;
  amounts: number[];
  criticalSnippet?: string;
  threadId?: string;
};

export function extractGmailEnrichedMetadata(
  msg: GmailMessage,
): GmailEnrichedMetadata {
  const raw = `${msg.subject} ${msg.snippet}`;
  const blob = raw.toLowerCase();
  const amounts = extractDollarAmounts(raw);
  const portfolioKeywords: string[] = [];
  if (/\bajax\b/i.test(blob)) portfolioKeywords.push("ajax");
  if (/\bnexus\b/i.test(blob)) portfolioKeywords.push("nexus");
  if (/\b(octane\s+core|core)\b/i.test(blob)) portfolioKeywords.push("core");
  if (/\boperating\s+cost\b/i.test(blob)) portfolioKeywords.push("operating_cost");
  if (/\bhosting\b/i.test(blob)) portfolioKeywords.push("hosting");

  const invoiceBalance =
    /\b(invoice|balance|amount due|total)\b/i.test(blob) && amounts[0] !== undefined
      ? amounts[0]
      : undefined;
  const hostingAmount =
    /\bhosting\b/i.test(blob) && amounts.length > 0
      ? amounts[amounts.length - 1]
      : undefined;

  return {
    portfolioKeywords,
    invoiceBalance,
    hostingAmount,
    amounts,
    criticalSnippet: extractCriticalSnippet(blob),
    threadId: msg.threadId,
  };
}

function resolveProjectId(
  msg: GmailMessage,
  context?: GmailNormalizeContext,
): string | undefined {
  const projects = context?.projects ?? [];
  const blob = `${msg.subject} ${msg.snippet}`;

  if (projects.length > 0) {
    for (const { pattern, name } of PORTFOLIO_SLUGS) {
      if (pattern.test(blob)) {
        const id = fuzzyMatchProjectId(name, projects);
        if (id) return id;
      }
    }
    const direct = fuzzyMatchProjectId(blob, projects);
    if (direct) return direct;
  }

  for (const { pattern, name } of PORTFOLIO_SLUGS) {
    if (pattern.test(blob)) {
      const stub = projects.find((p) => p.name === name);
      if (stub) return stub.id;
    }
  }
  return undefined;
}

function resolveEntityId(
  msg: GmailMessage,
  context?: GmailNormalizeContext,
  projectId?: string,
): string | undefined {
  const entities = context?.entities ?? [];
  if (entities.length === 0) return undefined;

  const blob = `${msg.subject} ${msg.snippet} ${msg.from}`.toLowerCase();

  if (projectId) {
    const linked = entities.find((e) =>
      e.linkedProjectIds?.includes(projectId),
    );
    if (linked) return linked.id;
  }

  for (const entity of entities) {
    const name = entity.name.toLowerCase();
    if (name.length >= 4 && blob.includes(name)) return entity.id;
    const token = name.split(/\s+/).pop();
    if (token && token.length >= 4 && blob.includes(token)) return entity.id;
  }
  return undefined;
}

function formatEnrichedSummary(
  sender: string,
  snippet: string,
  meta: GmailEnrichedMetadata,
  triageNote: string,
): string {
  const parts = [`${sender}: ${snippet}`.trim()];
  if (meta.invoiceBalance !== undefined) {
    parts.push(`Invoice balance ~$${meta.invoiceBalance.toFixed(2)}.`);
  }
  if (meta.hostingAmount !== undefined && meta.hostingAmount !== meta.invoiceBalance) {
    parts.push(`Hosting charge ~$${meta.hostingAmount.toFixed(2)}.`);
  }
  if (meta.criticalSnippet) {
    parts.push(`Exception: ${meta.criticalSnippet}`);
  }
  if (meta.portfolioKeywords.length > 0) {
    parts.push(`Portfolio: ${meta.portfolioKeywords.join(", ")}.`);
  }
  if (triageNote) parts.push(triageNote.trim());
  return parts.join(" ");
}

export function gmailMessageToSignal(
  msg: GmailMessage,
  context?: GmailNormalizeContext,
): Signal {
  const cls = classifyMessage(msg);
  const type = signalTypeFromClass(cls);
  const blob = messageBlob(msg);
  const ts = msg.date || new Date().toISOString();
  const isMock = msg.provenance === "mock";
  const triageNote =
    isMock && msg.requiresTriage ? " Sandbox inbox — triage before acting." : "";

  const sender = msg.from?.trim() || "Unknown sender";
  const subject = msg.subject?.trim() || "Gmail message";
  const snippet = msg.snippet?.trim() || "";
  const enriched = extractGmailEnrichedMetadata(msg);
  const projectId = resolveProjectId(msg, context);
  const entityId = resolveEntityId(msg, context, projectId);

  const enrichedMetadata: Record<string, string | number | boolean> = {
    ...(enriched.portfolioKeywords.length > 0
      ? { portfolioKeywords: enriched.portfolioKeywords.join(",") }
      : {}),
    ...(enriched.invoiceBalance !== undefined
      ? { invoiceBalance: enriched.invoiceBalance }
      : {}),
    ...(enriched.hostingAmount !== undefined
      ? { hostingAmount: enriched.hostingAmount }
      : {}),
    ...(enriched.criticalSnippet
      ? { criticalSnippet: enriched.criticalSnippet }
      : {}),
    ...(enriched.threadId ? { threadId: enriched.threadId } : {}),
    ...(enriched.amounts.length > 0
      ? { extractedAmounts: enriched.amounts.join(",") }
      : {}),
  };

  return {
    id: `sig-gmail-${msg.id}`,
    source: "gmail",
    type,
    title: subject,
    summary: formatEnrichedSummary(sender, snippet, enriched, triageNote),
    severity: severityFromClass(cls, blob),
    status: "new",
    ...(entityId ? { entityId } : {}),
    projectId,
    enrichedMetadata:
      Object.keys(enrichedMetadata).length > 0 ? enrichedMetadata : undefined,
    relatedRecordType: "gmail_message",
    relatedRecordId: msg.id,
    recommendedAction:
      cls === "finance"
        ? "Review in Finance or import matching CSV row."
        : cls === "risk"
          ? "Triage security or deployment risk in Connections and Signals."
          : cls === "opportunity"
            ? "Log decision or follow up from Inbox."
            : "Review thread and propose an Octane action if needed.",
    isLive: !isMock,
    isDerived: isMock,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function normalizeGmailSignals(
  messages: GmailMessage[],
  context?: GmailNormalizeContext,
): Signal[] {
  return messages.map((msg) => gmailMessageToSignal(msg, context));
}
