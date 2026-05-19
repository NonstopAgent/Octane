"use client";

import { SectionHeader } from "@/components/modules";
import { Card, CardContent } from "@/components/ui/card";

const SHORTCUTS = [
  { keys: "⌘/Ctrl + K", label: "Open command palette" },
  { keys: "New menu (top bar)", label: "Create inbox item, task, decision, and more" },
  { keys: "/today", label: "Today operating view" },
  { keys: "/inbox", label: "Quick capture inbox" },
  { keys: "Settings → Export JSON", label: "Back up local workspace data" },
] as const;

export function KeyboardShortcutsSection() {
  return (
    <section className="space-y-4" data-testid="settings-keyboard-shortcuts">
      <SectionHeader
        title="Keyboard shortcuts"
        description="Fast navigation while running Octane locally."
      />
      <Card className="border-zinc-800/80 bg-zinc-900/30">
        <CardContent className="divide-y divide-zinc-800/80 p-0">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.label}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm text-zinc-300">{shortcut.label}</span>
              <kbd className="w-fit rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono text-xs text-zinc-400">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
