import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Render the title with the signature Octane gradient (used for hero headers). */
  gradientTitle?: boolean;
};

export function PageHeader({
  title,
  description,
  actions,
  gradientTitle,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 pb-1 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1.5">
        <h1
          className={cn(
            "text-[1.75rem] font-semibold leading-tight tracking-tight",
            gradientTitle ? "text-gradient" : "text-foreground",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-zinc-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
