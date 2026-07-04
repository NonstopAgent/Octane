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
          <p className="mb-1 px-3 text-[9px] font-medium uppercase tracking-widest text-zinc-500">
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
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all",
                    isActive
                      ? "bg-gradient-to-r from-violet-500/25 via-fuchsia-500/10 to-transparent font-medium text-white ring-1 ring-inset ring-white/10"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white",
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
      <aside className="hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-white/10 bg-white/[0.02] p-4 backdrop-blur-2xl md:block">
        <div className="mb-4 px-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Octane Core</p>
          <p className="text-lg font-semibold text-gradient">Command Center</p>
        </div>
        <Separator className="mb-4 bg-white/10" />
        <NavLinks />
      </aside>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger render={<Button variant="outline" size="icon-sm" className="border-zinc-700 bg-zinc-900/80 text-zinc-200" />}>
            <Menu className="size-4" />
            <span className="sr-only">Open navigation</span>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto border-white/10 bg-[oklch(0.16_0.02_282)] p-4">
            <div className="mb-4 px-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Octane Core</p>
              <p className="text-lg font-semibold text-gradient">Command Center</p>
            </div>
            <Separator className="mb-4 bg-white/10" />
            <NavLinks />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
