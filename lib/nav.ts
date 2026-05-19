import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  Telescope,
  Map,
  MessageSquare,
  NotebookPen,
  Radio,
  Scale,
  Settings,
  Wallet,
  FolderKanban,
  Landmark,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

/** Final sidebar order. */
export const mainNavItems: NavItem[] = [
  { title: "Octane AI", href: "/chat", icon: MessageSquare },
  { title: "Universe", href: "/universe", icon: Globe },
  { title: "Today", href: "/today", icon: CalendarDays },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Outlook", href: "/outlook", icon: Telescope },
  { title: "Morning Briefing", href: "/briefing", icon: Radio },
  { title: "Inbox", href: "/inbox", icon: Inbox },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Activity", href: "/activity", icon: Activity },
  { title: "Review", href: "/review", icon: ClipboardCheck },
  { title: "Agents", href: "/agents", icon: Bot },
  { title: "Finance", href: "/finance", icon: Wallet },
  { title: "Holdings", href: "/holdings", icon: Landmark },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Decisions", href: "/decisions", icon: Scale },
  { title: "Roadmap", href: "/roadmap", icon: Map },
  { title: "Notes", href: "/notes", icon: NotebookPen },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const appRoutePrefixes = mainNavItems.map((item) => item.href);
