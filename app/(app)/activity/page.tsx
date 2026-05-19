"use client";

import {
  format,
  isToday,
  isValid,
  isYesterday,
  parseISO,
  startOfWeek,
} from "date-fns";
import { Activity as ActivityIcon, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { ActivityAction, ActivityEntityType, ActivityLog } from "@/lib/types";

const ENTITY_TYPES: ActivityEntityType[] = [
  "project",
  "task",
  "decision",
  "transaction",
  "document",
  "entity",
  "roadmap",
  "work_session",
  "inbox_item",
  "founder_note",
  "system",
];

const ACTIONS: ActivityAction[] = [
  "created",
  "updated",
  "deleted",
  "moved",
  "converted",
  "archived",
  "reset",
];

type DateGroup = "Today" | "Yesterday" | "This Week" | "Earlier";

function safeParseDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const date = parseISO(iso);
  return isValid(date) ? date : null;
}

function formatLogTime(iso: string): string {
  const date = safeParseDate(iso);
  if (!date) return "Unknown time";
  return format(date, "MMM d, yyyy · h:mm a");
}

function getDateGroup(iso: string, now: Date): DateGroup {
  const date = safeParseDate(iso);
  if (!date) return "Earlier";
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  if (date >= weekStart) return "This Week";
  return "Earlier";
}

const GROUP_ORDER: DateGroup[] = [
  "Today",
  "Yesterday",
  "This Week",
  "Earlier",
];

export default function ActivityPage() {
  const activityLogs = useOctaneStore((s) => s.activityLogs);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();

    return [...activityLogs]
      .filter((log) => {
        if (entityFilter !== "all" && log.entityType !== entityFilter) {
          return false;
        }
        if (actionFilter !== "all" && log.action !== actionFilter) {
          return false;
        }
        if (!query) return true;
        const haystack = [
          log.entityName,
          log.description,
          log.entityType,
          log.action,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aTime = safeParseDate(a.createdAt)?.getTime() ?? 0;
        const bTime = safeParseDate(b.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .map((log) => ({
        log,
        group: getDateGroup(log.createdAt, now),
      }));
  }, [activityLogs, search, entityFilter, actionFilter]);

  const grouped = useMemo(() => {
    const buckets: Record<DateGroup, ActivityLog[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: [],
    };
    for (const { log, group } of filtered) {
      buckets[group].push(log);
    }
    return buckets;
  }, [filtered]);

  const hasAny = filtered.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Activity"
        description="Audit trail of changes across your local workspace."
      />

      <Card className="border-zinc-800/80 bg-zinc-900/30">
        <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search className="absolute top-2.5 left-2.5 size-4 text-zinc-500" />
            <Input
              placeholder="Search activity…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="border-zinc-700 bg-zinc-900 pl-8"
            />
          </div>
          <select
            className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
          >
            <option value="all">All entity types</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatStatusLabel(type)}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
          >
            <option value="all">All actions</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {formatStatusLabel(action)}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {activityLogs.length === 0 ? (
        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="p-6">
            <EmptyState
              icon={ActivityIcon}
              title="No activity yet"
              description="Create or update projects, tasks, decisions, and other records to build your activity feed."
            />
          </CardContent>
        </Card>
      ) : !hasAny ? (
        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="p-6">
            <EmptyState
              icon={ActivityIcon}
              title="No matching activity"
              description="Try a different search term or clear your filters."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {GROUP_ORDER.map((group) => {
            const logs = grouped[group];
            if (!logs.length) return null;
            return (
              <section key={group} className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                  {group}
                </h2>
                <ul className="space-y-2">
                  {logs.map((log) => (
                    <li key={log.id}>
                      <Card className="border-zinc-800/80 bg-zinc-900/40">
                        <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-zinc-100">
                                {log.entityName}
                              </span>
                              <span className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-xs capitalize text-zinc-400">
                                {formatStatusLabel(log.action)}
                              </span>
                              <span className="rounded-md border border-zinc-800 px-1.5 py-0.5 text-xs capitalize text-zinc-500">
                                {formatStatusLabel(log.entityType)}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-500">
                              {log.description}
                            </p>
                          </div>
                          <p className="shrink-0 text-xs text-zinc-500">
                            {formatLogTime(log.createdAt)}
                          </p>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
