import { Suspense } from "react";

import { TodayView } from "@/components/modules/today/today-view";

export default function TodayPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <TodayView />
    </Suspense>
  );
}
