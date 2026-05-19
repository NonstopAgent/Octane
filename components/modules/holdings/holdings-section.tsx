"use client";

import type { ComponentType, ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function HoldingsSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Card
      id={id}
      className={cn(
        "border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60",
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Icon className="size-4 text-amber-400/90" aria-hidden />
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-zinc-500">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
