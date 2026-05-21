import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  Settings,
  Wallet,
  Zap,
} from "lucide-react";

export type NavSection = "executive" | "portfolio" | "operations" | "system";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  section: NavSection;
  badge?: string;
};

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  executive: "Executive Command",
  portfolio: "Portfolio",
  operations: "Operations",
  system: "System",
};

/**
 * Primary sidebar nav — 9 high-frequency anchors only.
 * All other routes (Roadmap, Decisions, Notes, Activity, etc.) remain fully
 * accessible via direct URL or in-page links; they're simply removed from the
 * sidebar to reduce visual noise.
 */
export const mainNavItems: NavItem[] = [
  // ── Executive Command ───────────────────────────────────
  { title: "Dashboard",  href: "/dashboard", icon: LayoutDashboard, section: "executive" },
  { title: "Today",      href: "/today",     icon: CalendarDays,    section: "executive" },
  // ── Portfolio ───────────────────────────────────────────
  { title: "Holdings",   href: "/holdings",  icon: Landmark,        section: "portfolio" },
  { title: "Projects",   href: "/projects",  icon: FolderKanban,    section: "portfolio" },
  { title: "Agents",     href: "/agents",    icon: Bot,             section: "portfolio" },
  { title: "Signals",    href: "/signals",   icon: Zap,             section: "portfolio" },
  // ── Operations ─────────────────────────────────────────
  { title: "Tasks",      href: "/tasks",     icon: CheckSquare,     section: "operations" },
  { title: "Finance",    href: "/finance",   icon: Wallet,          section: "operations" },
  { title: "Actions",    href: "/actions",   icon: ClipboardList,   section: "operations" },
  // ── System ──────────────────────────────────────────────
  { title: "Settings",   href: "/settings",  icon: Settings,        section: "system" },
];

/**
 * All route prefixes that belong to the app shell — used by middleware for
 * auth guards. Includes every page even if it's not in the visible sidebar.
 */
export const appRoutePrefixes = [
  "/dashboard", "/today", "/holdings", "/projects", "/agents", "/signals",
  "/tasks", "/finance", "/actions", "/settings",
  // Hidden from sidebar but still protected routes:
  "/connections", "/decisions", "/documents", "/roadmap", "/review",
  "/outlook", "/briefing", "/inbox", "/notes", "/activity", "/universe",
  "/coding",
];
