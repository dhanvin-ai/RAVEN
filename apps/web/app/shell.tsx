"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronRight,
  Flame,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  Repeat,
  ScrollText,
  X,
} from "lucide-react";
import {
  useState,
  type ReactNode,
} from "react";

// ============================================================
// NAVIGATION ITEMS
// ============================================================

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  badgeColor?: string;
}

const PRIMARY_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Observe",
    href: "/observe",
    icon: Activity,
    badge: "New",
    badgeColor: "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
  },
  {
    label: "Agents",
    href: "/agents",
    icon: Bot,
    badge: "4",
    badgeColor: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
  },
  {
    label: "Scenarios",
    href: "/scenarios",
    icon: ScrollText,
  },
  {
    label: "Red Teaming",
    href: "/red-team",
    icon: Flame,
  },
  {
    label: "Multi-Turn & Loops",
    href: "/multiturn",
    icon: Repeat,
  },
];

// ============================================================
// DESKTOP SIDEBAR
// ============================================================

function DesktopSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#0f172a] transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 dark:border-gray-800/80 px-4">
        <Link
          href="/"
          title="Go to Landing Page"
          className="flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          {/* Royal Blue Hexagon / Folded Ribbon Logo from Image 3 */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-sm shadow-blue-500/25">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>

          {!collapsed && (
            <span className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-white">
              RAVEN
            </span>
          )}
        </Link>

        {!collapsed && (
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 hover:text-gray-600 transition"
          >
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          {PRIMARY_NAV.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 text-[#2563eb] font-semibold dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <div className="flex items-center gap-3">
                  {isActive ? (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-white">
                      <CheckCircle2 size={12} strokeWidth={3} />
                    </div>
                  ) : (
                    <Icon
                      size={18}
                      className="text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300 transition"
                    />
                  )}
                  {!collapsed && <span>{item.label}</span>}
                </div>

                {!collapsed && item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Section (Expand button when collapsed) */}
      {collapsed && (
        <div className="shrink-0 p-2 border-t border-gray-100 dark:border-gray-800/80">
          <button
            onClick={onToggle}
            title="Expand sidebar"
            className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </aside>
  );
}

// ============================================================
// MOBILE DRAWER
// ============================================================

function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs lg:hidden"
        onClick={onClose}
      />

      <div className="fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col bg-white dark:bg-[#0f172a] shadow-2xl lg:hidden">
        <div className="flex h-16 items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563eb] text-white">
              <Bot size={18} />
            </div>
            <span className="text-base font-bold text-gray-900 dark:text-white">RAVEN</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav className="space-y-1">
            {PRIMARY_NAV.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition ${
                    isActive
                      ? "bg-blue-50 text-[#2563eb] font-semibold dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}

// ============================================================
// ROOT SHELL LAYOUT
// ============================================================

export default function ShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // If on landing page ("/"), render full width without sidebar
  if (pathname === "/") {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#0b0f19] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <DesktopSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </div>

      {/* Mobile Drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Main Column */}
      <div
        className={`min-h-screen transition-all duration-300 ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        {/* Mobile Header Bar (only visible on mobile to open drawer) */}
        <div className="flex h-14 items-center justify-between border-b border-gray-200/80 dark:border-gray-800 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563eb] text-white">
              <Bot size={14} />
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">RAVEN</span>
          </div>
        </div>

        {/* Page Children */}
        <div>{children}</div>
      </div>
    </div>
  );
}
