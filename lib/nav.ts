import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Code2,
  FileText,
  Inbox,
  LayoutDashboard,
  Map,
  NotebookPen,
  Plug,
  Radio,
  Scale,
  Settings,
  Wallet,
  FolderKanban,
  Landmark,
  Telescope,
  Zap,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

/** Sidebar order — company hub first, tools and experimental last. */
export const mainNavItems: NavItem[] = [
  // ── Command center ─────────────────────────────────────
  { title: "Today", href: "/today", icon: CalendarDays },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Signals", href: "/signals", icon: Zap },
  // ── Holdings & Portfolio ────────────────────────────────
  { title: "Holdings", href: "/holdings", icon: Landmark },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Agents", href: "/agents", icon: Bot },
  // ── Operations ─────────────────────────────────────────
  { title: "Actions", href: "/actions", icon: ClipboardList },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Inbox", href: "/inbox", icon: Inbox },
  { title: "Connections", href: "/connections", icon: Plug },
  // ── Finance & Legal ─────────────────────────────────────
  { title: "Finance", href: "/finance", icon: Wallet },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Decisions", href: "/decisions", icon: Scale },
  // ── Strategy & Intelligence ─────────────────────────────
  { title: "Outlook", href: "/outlook", icon: Telescope },
  { title: "Morning Briefing", href: "/briefing", icon: Radio },
  { title: "Roadmap", href: "/roadmap", icon: Map },
  { title: "Review", href: "/review", icon: ClipboardCheck },
  // ── History & Notes ─────────────────────────────────────
  { title: "Activity", href: "/activity", icon: Activity },
  { title: "Notes", href: "/notes", icon: NotebookPen },
  // ── Settings ────────────────────────────────────────────
  { title: "Settings", href: "/settings", icon: Settings },
  // ── Experimental ───────────────────────────────────────
  { title: "Octane Engineer", href: "/coding", icon: Code2, badge: "exp" },
];

export const appRoutePrefixes = mainNavItems.map((item) => item.href);
