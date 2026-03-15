"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Radio,
  Users,
  Send,
  Kanban,
  Settings,
  Zap,
  Database,
  Play,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/recruiter", icon: LayoutDashboard },
  { label: "Pre-Fair", href: "/recruiter/pre-fair", icon: ClipboardList },
  { label: "Live Fair", href: "/recruiter/live-fair", icon: Radio },
  { label: "Candidates", href: "/recruiter/candidates", icon: Users },
  { label: "Follow-ups", href: "/recruiter/follow-ups", icon: Send },
  { label: "Pipeline", href: "/recruiter/pipeline", icon: Kanban },
  { label: "Demo", href: "/recruiter/demo", icon: Play },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-50 flex-col bg-sidebar-bg border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground leading-tight">
            FairSignal
          </span>
          <span className="text-[10px] text-sidebar-muted leading-tight">
            Recruiter Copilot
          </span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-0.5 px-3 mt-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/recruiter" && pathname.startsWith(item.href));
          const isDashboardActive =
            item.href === "/recruiter" && pathname === "/recruiter";

          const active = isActive || isDashboardActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom - Dev Data & Settings */}
      <div className="px-3 pb-4 space-y-0.5">
        <Link
          href="/dev"
          aria-current={pathname === "/dev" ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
            pathname === "/dev"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <Database className="h-4 w-4 shrink-0" />
          <span>Dev Data</span>
        </Link>
        <Link
          href="/recruiter/settings"
          aria-current={pathname === "/recruiter/settings" ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
            pathname === "/recruiter/settings"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
