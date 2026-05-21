"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  FileText,
  FolderKanban,
  Inbox,
  LogOut,
  Map,
  NotebookPen,
  Plus,
  Scale,
  Search,
  Sparkles,
  Timer,
  User,
  Wallet,
  Landmark,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@/lib/supabase/client";
import { clearAuthSession } from "@/lib/auth/mock-auth";
import { useOctaneStore } from "@/lib/store/octane-store";
import { OctaneAdvisorPanel } from "@/components/modules/advisor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { CommandPalette } from "./command-palette";

const NEW_ITEMS = [
  { label: "New Inbox Item", href: "/inbox?new=1", icon: Inbox },
  { label: "New Work Session", href: "/today?session=1", icon: Timer },
  { label: "New Founder Note", href: "/notes?new=1", icon: NotebookPen },
  { label: "New Project", href: "/projects?new=1", icon: FolderKanban },
  { label: "New Task", href: "/tasks?new=1", icon: CheckSquare },
  { label: "New Decision", href: "/decisions?new=1", icon: Scale },
  { label: "New Transaction", href: "/finance?new=1", icon: Wallet },
  {
    label: "New Document Metadata",
    href: "/documents?new=1",
    icon: FileText,
  },
  { label: "New Roadmap Item", href: "/roadmap?new=1", icon: Map },
  {
    label: "New Compliance Reminder",
    href: "/holdings?new=compliance",
    icon: Landmark,
  },
  {
    label: "New Legal Question",
    href: "/holdings?new=legal-question",
    icon: Landmark,
  },
  {
    label: "New IP Asset",
    href: "/holdings?new=ip-asset",
    icon: Landmark,
  },
  { label: "New Entity", href: "/settings?new=entity", icon: User },
] as const;

export function AppTopbar() {
  const router = useRouter();
  const profileName = useOctaneStore((s) => s.profile?.name ?? "");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);

  // Derive initials from name
  const initials = profileName
    ? profileName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "OA";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      // ignore signout errors
    }
    clearAuthSession();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-zinc-800/80 bg-zinc-950/70 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <button
            type="button"
            className="relative w-full text-left"
            onClick={() => setPaletteOpen(true)}
          >
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-500" />
            <Input
              readOnly
              placeholder="Search… (⌘K)"
              className="cursor-pointer pl-8 text-zinc-300 placeholder:text-zinc-500"
            />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdvisorOpen(true)}
            className="h-9 gap-1.5 border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800"
          >
            <Sparkles className="size-3.5 text-amber-400" aria-hidden />
            <span className="hidden sm:inline">Advisor</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="border-zinc-700 bg-zinc-900/70 text-zinc-200"
                />
              }
            >
              <Plus className="size-4" />
              New
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 bg-zinc-900 text-zinc-100"
            >
              <DropdownMenuLabel>Create</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {NEW_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.href}
                    onClick={() => router.push(item.href)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500" />
              }
            >
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 bg-zinc-900 text-zinc-100"
            >
              <DropdownMenuLabel>
                {profileName || "Octane Operator"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings" />}>
                <User className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/setup" />}>
                <Sparkles className="size-4" />
                Workspace Setup
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-300 focus:text-red-200"
              >
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <Sheet open={advisorOpen} onOpenChange={setAdvisorOpen}>
        <SheetContent
          side="right"
          className="flex w-full max-w-md flex-col border-zinc-800 bg-zinc-950 p-0"
        >
          <SheetHeader className="border-b border-zinc-800/80 px-4 py-3">
            <SheetTitle className="text-zinc-100">Octane Advisor</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <OctaneAdvisorPanel context="dashboard" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
