import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  FileText,
  Inbox,
  LayoutDashboard,
  Map,
  NotebookPen,
  Radio,
  Scale,
  Settings,
  Wallet,
  FolderKanban,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

/** Final sidebar order (checkpoint 7B). */
export const mainNavItems: NavItem[] = [
  { title: "Today", href: "/today", icon: CalendarDays },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Morning Briefing", href: "/briefing", icon: Radio },
  { title: "Inbox", href: "/inbox", icon: Inbox },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Activity", href: "/activity", icon: Activity },
  { title: "Review", href: "/review", icon: ClipboardCheck },
  { title: "Agents", href: "/agents", icon: Bot },
  { title: "Finance", href: "/finance", icon: Wallet },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Decisions", href: "/decisions", icon: Scale },
  { title: "Roadmap", href: "/roadmap", icon: Map },
  { title: "Notes", href: "/notes", icon: NotebookPen },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const appRoutePrefixes = mainNavItems.map((item) => item.href);
