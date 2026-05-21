import { Badge } from "@/components/ui/badge";

/** Shown when Gmail (or other comms) are served from mock/sandbox data. */
export function SandboxCommsBadge() {
  return (
    <Badge
      variant="outline"
      className="border-amber-900/50 bg-amber-950/25 text-amber-300/90 text-[10px] font-medium"
    >
      Sandbox: Simulated Communications
    </Badge>
  );
}
