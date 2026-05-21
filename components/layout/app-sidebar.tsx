"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { mainNavItems, NAV_SECTION_LABELS, type NavSection } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  // Group items by section, preserving first-seen section order
  const sections: NavSection[] = [];
  const grouped = {} as Record<NavSection, typeof mainNavItems>;
  for (const item of mainNavItems) {
    if (!grouped[item.section]) {
      grouped[item.section] = [];
      sections.push(item.section);
    }
    grouped[item.section].push(item);
  }

  return (
    <nav className="space-y-4">
      {sections.map((section) => (
        <div key={section}>
          <p className="mb-1 px-3 text-[9px] font-medium uppercase tracking-widest text-zinc-600">
            {NAV_SECTION_LABELS[section]}
          </p>
          <div className="space-y-0.5">
            {grouped[section].map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-zinc-700/50 text-zinc-50"
                      : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppSidebar() {
  return (
    <>
      <aside className="hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-zinc-800/80 bg-zinc-950/70 p-4 md:block">
        <div className="mb-4 px-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Octane Core</p>
          <p className="text-lg font-semibold text-zinc-100">Command Center</p>
        </div>
        <Separator className="mb-4 bg-zinc-800" />
        <NavLinks />
      </aside>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger render={<Button variant="outline" size="icon-sm" className="border-zinc-700 bg-zinc-900/80 text-zinc-200" />}>
            <Menu className="size-4" />
            <span className="sr-only">Open navigation</span>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 px-2">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Octane Core</p>
              <p className="text-lg font-semibold text-zinc-100">Command Center</p>
            </div>
            <Separator className="mb-4 bg-zinc-800" />
            <NavLinks />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
