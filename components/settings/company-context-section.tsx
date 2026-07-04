"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { SectionHeader } from "@/components/modules";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCompanyStore } from "@/lib/store/company-store";

export function CompanyContextSection() {
  const context = useCompanyStore((s) => s.context);
  const updatedAt = useCompanyStore((s) => s.updatedAt);
  const setContext = useCompanyStore((s) => s.setContext);
  const resetToDefault = useCompanyStore((s) => s.resetToDefault);

  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState(context);

  useEffect(() => setMounted(true), []);
  // Keep the editor in sync when the store changes elsewhere (e.g. reset).
  useEffect(() => setDraft(context), [context]);

  if (!mounted) return null;
  const dirty = draft !== context;

  return (
    <section className="space-y-4" data-testid="settings-company-context">
      <SectionHeader
        title="Company Context (what the AI knows)"
        description="Octane's AI reads this on every daily brief, chat answer, and triage. Keep the vision and future plans current — the AI is only as smart about your business as this document is."
      />
      <Card className="border-zinc-800/80 bg-zinc-900/30">
        <CardContent className="space-y-3 pt-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck
            aria-label="Company context"
            className="h-96 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200 focus:border-amber-700/70 focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-500">
              {draft.length.toLocaleString()} chars
              {updatedAt
                ? ` · edited ${new Date(updatedAt).toLocaleDateString()}`
                : " · using default"}
              {dirty ? (
                <span className="text-amber-400/80"> · unsaved changes</span>
              ) : null}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-zinc-700"
                onClick={() => {
                  resetToDefault();
                  toast.success("Reset to the default company context");
                }}
              >
                <RotateCcw className="size-4" />
                Reset to default
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!dirty}
                onClick={() => {
                  setContext(draft);
                  toast.success("Company context saved — the AI uses it now");
                }}
              >
                <Save className="size-4" />
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
