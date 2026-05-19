"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { EmptyState, StatusBadge } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Document, DocumentCategory } from "@/lib/types";
import type { OctanePersistedState } from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";

import { HoldingsSection } from "./holdings-section";

const OWNERSHIP_CATEGORIES: DocumentCategory[] = [
  "legal",
  "financial",
  "compliance",
  "contracts",
  "ip",
];

const FILTERS: Array<DocumentCategory | "all"> = ["all", ...OWNERSHIP_CATEGORIES];

const tableClass =
  "w-full text-left text-sm [&_th]:border-b [&_th]:border-zinc-800 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-zinc-400 [&_td]:border-b [&_td]:border-zinc-800/60 [&_td]:px-3 [&_td]:py-2.5 [&_tr:last-child_td]:border-0";

export function DocumentOwnershipSection({
  state,
  detailId,
}: {
  state: OctanePersistedState;
  detailId?: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<DocumentCategory | "all">("all");

  const projectName = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p.name])),
    [state.projects],
  );

  const rows = useMemo(() => {
    const sorted = [...state.documents].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (filter === "all") {
      return sorted.filter((d) => OWNERSHIP_CATEGORIES.includes(d.category));
    }
    return sorted.filter((d) => d.category === filter);
  }, [filter, state.documents]);

  return (
    <HoldingsSection
      id="document-ownership"
      title="Document ownership"
      description="Legal, financial, and compliance metadata — counsel review flags."
      icon={FileText}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((cat) => (
          <Button
            key={cat}
            type="button"
            size="sm"
            variant={filter === cat ? "default" : "outline"}
            className={cn(
              filter !== cat && "border-zinc-700 bg-transparent text-zinc-400",
            )}
            onClick={() => setFilter(cat)}
          >
            {cat === "all" ? "All" : cat}
          </Button>
        ))}
        <Link href="/documents" className="ml-auto text-xs text-amber-400/90 hover:underline">
          Open Documents →
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents in this filter"
          description="Add legal or financial document metadata on the Documents page."
          action={{
            label: "Documents",
            onClick: () => router.push("/documents?new=1"),
          }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800/80">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Project</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  projectLabel={
                    doc.projectId
                      ? (projectName.get(doc.projectId) ?? doc.projectId)
                      : "—"
                  }
                  highlighted={doc.id === detailId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HoldingsSection>
  );
}

function DocumentRow({
  doc,
  projectLabel,
  highlighted,
}: {
  doc: Document;
  projectLabel: string;
  highlighted?: boolean;
}) {
  const needsReview = doc.status === "needs_review";
  return (
    <tr className={highlighted ? "bg-amber-500/10" : undefined}>
      <td className="font-medium text-zinc-100">
        <Link
          href={`/documents?detail=${encodeURIComponent(doc.id)}`}
          className="hover:text-amber-200"
        >
          {doc.name}
        </Link>
      </td>
      <td>{doc.category}</td>
      <td>{projectLabel}</td>
      <td>
        <StatusBadge domain="document" status={doc.status} />
      </td>
      <td>
        {needsReview ? (
          <Badge className="bg-amber-500/20 text-amber-200">Needs legal review</Badge>
        ) : (
          <span className="text-zinc-500">—</span>
        )}
      </td>
    </tr>
  );
}
