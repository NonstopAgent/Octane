"use client";

import { format, parseISO } from "date-fns";
import { Activity as ActivityIcon } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Card, CardContent } from "@/components/ui/card";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { ActivityLog } from "@/lib/types";

const tableClass =
  "w-full text-left text-sm [&_th]:border-b [&_th]:border-zinc-800 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-zinc-400 [&_td]:border-b [&_td]:border-zinc-800/60 [&_td]:px-3 [&_td]:py-2.5 [&_tr:last-child_td]:border-0";

export default function ActivityPage() {
  const activityLogs = useOctaneStore((s) => s.activityLogs);

  const sorted = useMemo(() => {
    const copy: ActivityLog[] = [...activityLogs];
    copy.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return copy;
  }, [activityLogs]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Activity"
        description="Audit trail of changes across your local workspace."
      />

      <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-x-auto">
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ActivityIcon}
                title="No activity yet"
                description="Create or update projects, tasks, decisions, and other records to build your activity feed. Every change is logged locally so you can trace what happened and when."
              />
            </div>
          ) : (
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity type</th>
                  <th>Entity name</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-zinc-400">
                      {format(parseISO(log.timestamp), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="capitalize text-zinc-300">
                      {formatStatusLabel(log.action)}
                    </td>
                    <td className="capitalize text-zinc-400">
                      {formatStatusLabel(log.entityType)}
                    </td>
                    <td className="font-medium text-zinc-200">
                      {log.entityName}
                    </td>
                    <td className="text-zinc-500">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
