import type { GmailMessage, GmailSignalClass } from "@/lib/types/gmail-message";
import type { Signal, SignalSeverity, SignalType } from "@/lib/types/signal";

function classifyMessage(msg: GmailMessage): GmailSignalClass {
  if (msg.signalClass) return msg.signalClass;
  const blob = `${msg.subject} ${msg.snippet} ${msg.from}`.toLowerCase();
  if (
    /\b(invoice|payment|billing|stripe|subscription|receipt|refund|charge)\b/.test(
      blob,
    )
  ) {
    return "finance";
  }
  if (
    /\b(alert|security|vulnerab|dependabot|failed|error|breach|urgent)\b/.test(
      blob,
    )
  ) {
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

function severityFromClass(
  cls: GmailSignalClass,
  requiresTriage?: boolean,
): SignalSeverity {
  if (requiresTriage && cls === "risk") return "high";
  if (requiresTriage) return "medium";
  if (cls === "risk") return "high";
  if (cls === "action") return "medium";
  return "low";
}

export function gmailMessageToSignal(msg: GmailMessage): Signal {
  const cls = classifyMessage(msg);
  const type = signalTypeFromClass(cls);
  const ts = msg.date || new Date().toISOString();
  const triageNote = msg.requiresTriage
    ? " Mock inbox — triage before acting."
    : "";

  return {
    id: `sig-gmail-${msg.id}`,
    source: "gmail",
    type,
    title: msg.subject || "Gmail message",
    summary: `${msg.from}: ${msg.snippet}${triageNote}`.trim(),
    severity: severityFromClass(cls, msg.requiresTriage),
    status: "new",
    entityId: msg.id,
    relatedRecordType: "gmail_message",
    relatedRecordId: msg.id,
    recommendedAction:
      cls === "finance"
        ? "Review in Finance or import matching CSV row."
        : cls === "risk"
          ? "Triage security or deployment risk."
          : cls === "opportunity"
            ? "Log decision or follow up from Inbox."
            : "Review thread and propose an Octane action if needed.",
    isLive: msg.provenance === "live",
    isDerived: msg.provenance === "mock",
    createdAt: ts,
    updatedAt: ts,
  };
}

export function normalizeGmailSignals(messages: GmailMessage[]): Signal[] {
  return messages.map(gmailMessageToSignal);
}
