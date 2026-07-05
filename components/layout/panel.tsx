import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Unified glass panel — the app's single card system. A consistent header
 * (icon + title + optional right-aligned action) over a frosted surface.
 */
export function Panel({
  title,
  icon: Icon,
  iconClass = "text-zinc-400",
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  icon?: ComponentType<{ className?: string }>;
  iconClass?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("glass rounded-2xl p-5", className)}>
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title ? (
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
              {Icon ? <Icon className={cn("size-4", iconClass)} /> : null}
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Lightweight section label for grouping non-card content. */
export function SectionHeading({
  title,
  icon: Icon,
  iconClass = "text-zinc-400",
  action,
  className,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  iconClass?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2 px-1", className)}>
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
        {Icon ? <Icon className={cn("size-4", iconClass)} /> : null}
        {title}
      </h2>
      {action}
    </div>
  );
}
