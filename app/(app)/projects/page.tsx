import { Suspense } from "react";

import { ProjectsView } from "@/components/modules/projects/projects-view";

export default function ProjectsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <ProjectsView />
    </Suspense>
  );
}
