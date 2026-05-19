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
  Timer,
  User,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { clearAuthSession } from "@/lib/auth/mock-auth";
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
    label: "Document Metadata",
    href: "/documents?new=1",
    icon: FileText,
  },
  { label: "New Entity", href: "/settings?new=entity", icon: User },
  { label: "Roadmap Item", href: "/roadmap?new=1", icon: Map },
] as const;

export function AppTopbar() {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/70 px-4 backdrop-blur">
        <div className="w-full max-w-md">
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

        <div className="ml-auto flex items-center gap-2">
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
                    render={<Link href={item.href} />}
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
                <AvatarFallback>OA</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 bg-zinc-900 text-zinc-100"
            >
              <DropdownMenuLabel>Octane Operator</DropdownMenuLabel>
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
    </>
  );
}
