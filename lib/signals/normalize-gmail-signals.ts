import type { GmailMessage, GmailSignalClass } from "@/lib/types/gmail-message";
import type { Signal, SignalSeverity, SignalType } from "@/lib/types/signal";

function messageBlob(msg: GmailMessage): string {
  return `${msg.subject} ${msg.snippet} ${msg.from}`.toLowerCase();
}

function classifyMessage(msg: GmailMessage): GmailSignalClass {
  if (msg.signalClass) return msg.signalClass;
  const blob = messageBlob(msg);

  if (
    /\b(invoice|payment|billing|stripe|subscription|receipt|refund|charge|past due)\b/.test(
      blob,
    )
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

  if (/\b(failed|error|down|outage|incident)\b/.test(blob)) {
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
      /\b(critical|breach|compromise|failed build|deployment failed|security alert)\b/.test(
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
    if (/\b(invoice|payment|billing)\b/.test(blob)) {
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

export function gmailMessageToSignal(msg: GmailMessage): Signal {
  const cls = classifyMessage(msg);
  const type = signalTypeFromClass(cls);
  const blob = messageBlob(msg);
  const ts = msg.date || new Date().toISOString();
  const isMock = msg.provenance === "mock";
  const triageNote = isMock && msg.requiresTriage
    ? " Sandbox inbox — triage before acting."
    : "";

  const sender = msg.from?.trim() || "Unknown sender";
  const subject = msg.subject?.trim() || "Gmail message";
  const snippet = msg.snippet?.trim() || "";

  return {
    id: `sig-gmail-${msg.id}`,
    source: "gmail",
    type,
    title: subject,
    summary: `${sender}: ${snippet}${triageNote}`.trim(),
    severity: severityFromClass(cls, blob),
    status: "new",
    entityId: msg.id,
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

export function normalizeGmailSignals(messages: GmailMessage[]): Signal[] {
  return messages.map(gmailMessageToSignal);
}
