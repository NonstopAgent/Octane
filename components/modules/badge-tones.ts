export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export const badgeToneClass: Record<BadgeTone, string> = {
  neutral:
    "border-zinc-700/80 bg-zinc-900/60 text-zinc-300",
  info: "border-sky-800/60 bg-sky-950/50 text-sky-300",
  success:
    "border-emerald-800/60 bg-emerald-950/50 text-emerald-300",
  warning:
    "border-amber-700/70 bg-amber-950/50 text-amber-300",
  danger: "border-red-800/60 bg-red-950/50 text-red-300",
};

export function formatStatusLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
