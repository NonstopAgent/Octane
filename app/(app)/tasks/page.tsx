import { Suspense } from "react";

import { TasksView } from "@/components/modules/tasks/tasks-view";

export default function TasksPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <TasksView />
    </Suspense>
  );
}
