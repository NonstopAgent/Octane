import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Map,
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

export const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Morning Briefing", href: "/briefing", icon: Radio },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Activity", href: "/activity", icon: Activity },
  { title: "Agents", href: "/agents", icon: Bot },
  { title: "Finance", href: "/finance", icon: Wallet },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Decisions", href: "/decisions", icon: Scale },
  { title: "Roadmap", href: "/roadmap", icon: Map },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const appRoutePrefixes = mainNavItems.map((item) => item.href);
