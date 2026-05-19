"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Plus, Scale, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, SectionHeader, StatusBadge } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Decision, DecisionCategory, DecisionStatus } from "@/lib/types";

const CATEGORIES: DecisionCategory[] = [
  "product",
  "finance",
  "legal",
  "hiring",
  "strategy",
  "investing",
  "operations",
];

const STATUSES: DecisionStatus[] = [
  "active",
  "under_review",
  "completed",
  "reversed",
];

const emptyForm = {
  title: "",
  summary: "",
  category: "strategy" as DecisionCategory,
  projectId: "",
  reasoning: "",
  optionsConsidered: "",
  finalDecision: "",
  expectedOutcome: "",
  reviewDate: "",
  status: "active" as DecisionStatus,
};

export default function DecisionsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <DecisionsPageContent />
    </Suspense>
  );
}

function DecisionsPageContent() {
  const searchParams = useSearchParams();
  const decisions = useOctaneStore((state) => state.decisions);
  const projects = useOctaneStore((state) => state.projects);
  const createDecision = useOctaneStore((state) => state.createDecision);
  const getProjectById = useOctaneStore((state) => state.getProjectById);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DecisionCategory | "all">(
    "all",
  );
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Decision | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setDialogOpen(true);
    }
    const detail = searchParams.get("detail");
    if (detail) {
      const decision = decisions.find((d) => d.id === detail);
      if (decision) setSelected(decision);
    }
  }, [searchParams, decisions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...decisions]
      .filter((decision) => {
        if (categoryFilter !== "all" && decision.category !== categoryFilter) {
          return false;
        }
        if (projectFilter !== "all" && decision.projectId !== projectFilter) {
          return false;
        }
        if (!query) return true;
        return (
          decision.title.toLowerCase().includes(query) ||
          decision.summary.toLowerCase().includes(query) ||
          decision.finalDecision.toLowerCase().includes(query)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [decisions, search, categoryFilter, projectFilter]);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.summary.trim()) return;

    const options = form.optionsConsidered
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);

    createDecision({
      title: form.title.trim(),
      summary: form.summary.trim(),
      category: form.category,
      projectId: form.projectId || undefined,
      reasoning: form.reasoning.trim() || "—",
      optionsConsidered: options.length > 0 ? options : ["—"],
      finalDecision: form.finalDecision.trim() || "Pending",
      expectedOutcome: form.expectedOutcome.trim() || "—",
      reviewDate: form.reviewDate || undefined,
      status: form.status,
    });
    setDialogOpen(false);
    setForm(emptyForm);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Decisions"
        description="Strategic and operational choices with reasoning on record."
        actions={
          <Button type="button" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New Decision
          </Button>
        }
      />

      <Card className="border-zinc-800/80 bg-zinc-900/30">
        <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search className="absolute top-2.5 left-2.5 size-4 text-zinc-500" />
            <Input
              placeholder="Search decisions…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="border-zinc-700 bg-zinc-900 pl-8"
            />
          </div>
          <select
            className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value as DecisionCategory | "all")
            }
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatStatusLabel(category)}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="all">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          title="Decision Log"
          description="Timeline of founder decisions, newest first."
        />
        <div className="relative space-y-0">
          <div
            className="absolute top-0 bottom-0 left-4 w-px bg-zinc-800"
            aria-hidden
          />
          {decisions.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="No decisions on record"
              description="Decisions capture why you chose a path — options, reasoning, and expected outcomes. Log your first decision before context fades."
              action={{
                label: "New Decision",
                onClick: () => setDialogOpen(true),
              }}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="No decisions match"
              description="Try different filters or create a new decision."
              action={{
                label: "New Decision",
                onClick: () => setDialogOpen(true),
              }}
            />
          ) : (
            filtered.map((decision) => {
              const project = decision.projectId
                ? getProjectById(decision.projectId)
                : undefined;
              return (
                <article
                  key={decision.id}
                  className="relative flex gap-4 pb-6 pl-10"
                >
                  <span className="absolute left-2.5 top-2 size-3 rounded-full border-2 border-amber-500/80 bg-zinc-950" />
                  <Card
                    className="flex-1 cursor-pointer border-zinc-800/80 bg-zinc-900/40 transition-colors hover:border-zinc-700"
                    onClick={() => setSelected(decision)}
                  >
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-zinc-100">
                          {decision.title}
                        </h3>
                        <StatusBadge
                          domain="decision"
                          status={decision.status}
                        />
                        <span className="text-xs text-zinc-500">
                          {formatStatusLabel(decision.category)}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400">{decision.summary}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span>
                          {format(new Date(decision.updatedAt), "MMM d, yyyy")}
                        </span>
                        {project ? <span>{project.name}</span> : null}
                      </div>
                    </CardContent>
                  </Card>
                </article>
              );
            })
          )}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 ring-zinc-800/80 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Decision</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Capture the choice, options, and expected outcome.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dec-title">Title</Label>
              <Input
                id="dec-title"
                required
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dec-summary">Summary</Label>
              <Input
                id="dec-summary"
                required
                value={form.summary}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, summary: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="dec-category">Category</Label>
                <select
                  id="dec-category"
                  className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      category: event.target.value as DecisionCategory,
                    }))
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {formatStatusLabel(category)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dec-status">Status</Label>
                <select
                  id="dec-status"
                  className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      status: event.target.value as DecisionStatus,
                    }))
                  }
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dec-project">Project</Label>
              <select
                id="dec-project"
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                value={form.projectId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, projectId: event.target.value }))
                }
              >
                <option value="">None</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dec-reasoning">Reasoning</Label>
              <textarea
                id="dec-reasoning"
                rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                value={form.reasoning}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, reasoning: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dec-options">Options (one per line)</Label>
              <textarea
                id="dec-options"
                rows={3}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                value={form.optionsConsidered}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    optionsConsidered: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dec-final">Final decision</Label>
              <textarea
                id="dec-final"
                rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                value={form.finalDecision}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    finalDecision: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dec-outcome">Expected outcome</Label>
              <Input
                id="dec-outcome"
                value={form.expectedOutcome}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    expectedOutcome: event.target.value,
                  }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dec-review">Review date</Label>
              <Input
                id="dec-review"
                type="date"
                value={form.reviewDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, reviewDate: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <DialogFooter className="border-zinc-800/80 bg-zinc-900/40 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Decision</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-lg"
        >
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-zinc-50">{selected.title}</SheetTitle>
                <SheetDescription className="text-zinc-400">
                  {selected.summary}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4 pt-0 text-sm">
                <StatusBadge domain="decision" status={selected.status} />
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">
                    Reasoning
                  </p>
                  <p className="mt-1 text-zinc-300">{selected.reasoning}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">
                    Options considered
                  </p>
                  <ul className="mt-1 list-inside list-disc text-zinc-300">
                    {selected.optionsConsidered.map((option) => (
                      <li key={option}>{option}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">
                    Final decision
                  </p>
                  <p className="mt-1 text-zinc-200">{selected.finalDecision}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">
                    Expected outcome
                  </p>
                  <p className="mt-1 text-zinc-300">{selected.expectedOutcome}</p>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
