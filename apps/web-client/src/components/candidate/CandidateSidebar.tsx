"use client";

/**
 * Candidate navigation.
 *
 * Forked from `src/components/sidebar.tsx` rather than parameterised: the two
 * navs are visually identical today, but the candidate side is a different
 * product with a different audience and will drift. Sharing one component
 * would mean every recruiter nav tweak silently reshapes the candidate app.
 * Every class string here is copied verbatim so the two stay in visual sync
 * until someone deliberately changes one.
 */

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  UserRound,
  Target,
  Sparkles,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "My Application", href: "/candidate",          icon: LayoutDashboard },
  { label: "My Profile",     href: "/candidate/profile",  icon: UserRound },
  { label: "Role Matches",   href: "/candidate/matches",  icon: Target },
  { label: "AI Feedback",    href: "/candidate/feedback", icon: Sparkles },
  { label: "Career Fair",    href: "/candidate/fair",     icon: CalendarDays },
];

export function CandidateSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("candidate-sidebar-collapsed") === "true";
  });

  const toggle = (value: boolean) => {
    setIsCollapsed(value);
    localStorage.setItem("candidate-sidebar-collapsed", String(value));
  };

  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const avatarUrl = user?.imageUrl;
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Your account";
  const initials =
    `${firstName[0] ?? ""}${lastName[0] ?? ""}` || (email[0] ?? "?").toUpperCase();

  const Avatar = ({ size = 32 }: { size?: number }) =>
    avatarUrl ? (
      <img
        src={avatarUrl}
        alt={displayName}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    ) : (
      <div
        className="rounded-full bg-[#0e3d27] flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <span className="text-white text-xs font-semibold">{initials}</span>
      </div>
    );

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[#f7f7f7] rounded-2xl shadow-[0px_1px_4px_0px_rgba(0,0,0,0.05)] shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
        isCollapsed ? "w-[68px]" : "w-[259px]",
      )}
    >
      {/* ── Logo / Header ── */}
      <div
        className={cn(
          "flex items-center border-b border-[#e2e8e5] py-6 shrink-0",
          isCollapsed ? "flex-col gap-2 justify-center px-2" : "justify-between px-4",
        )}
      >
        <Link
          href="/"
          aria-label="Go to home"
          className={cn("flex items-center gap-1 min-w-0 shrink-0", isCollapsed && "justify-center")}
        >
          <img
            src="/aihire-logo.png"
            alt="AlHire logo"
            className="w-12 h-12 object-cover shrink-0"
          />
          {!isCollapsed && (
            <span className="font-semibold text-[20px] text-[#111827] leading-5 whitespace-nowrap">
              AlHire
            </span>
          )}
        </Link>

        {isCollapsed ? (
          <button
            onClick={() => toggle(false)}
            aria-label="Expand sidebar"
            className="text-[#4b5563] hover:text-[#0e3d27] hover:bg-[#e8f5ee] rounded-[8px] p-1.5 transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => toggle(true)}
            aria-label="Collapse sidebar"
            className="text-[#4b5563] hover:text-[#111827] transition-colors shrink-0"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav
        className={cn(
          "flex-1 flex flex-col gap-1 py-8 overflow-y-auto overflow-x-hidden",
          isCollapsed ? "px-2 items-center" : "px-4",
        )}
      >
        {navItems.map((item) => {
          // `/candidate` is a prefix of every other route, so it must match
          // exactly or it would render active on every page.
          const isActive =
            item.href === "/candidate"
              ? pathname === "/candidate"
              : pathname === item.href || pathname.startsWith(item.href + "/");

          if (isCollapsed) {
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "flex items-center justify-center rounded-[10px] p-3 transition-colors",
                  isActive
                    ? "bg-[#e8f5ee] text-[#0e3d27]"
                    : "text-[#4b5563] hover:bg-[#e8f5ee]/60 hover:text-[#0e3d27]",
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[10px] py-3 pr-3 text-[14px] tracking-[-0.015em] transition-colors whitespace-nowrap",
                isActive
                  ? "bg-[#e8f5ee] border-l-[5px] border-[#1f6b43] pl-[17px] font-semibold text-[#0e3d27]"
                  : "pl-3 font-normal text-[#4b5563] hover:bg-[#e8f5ee]/60 hover:text-[#0e3d27]",
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile ── */}
      {isCollapsed ? (
        <div className="py-3 px-2 flex flex-col items-center gap-2 border-t border-[#e2e8e5] shrink-0">
          <Avatar />
        </div>
      ) : (
        <div className="px-4 py-4 border-t border-[#e2e8e5] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[14px] font-semibold text-[#0b0b0b] leading-4 whitespace-nowrap overflow-hidden text-ellipsis">
                {displayName}
              </span>
              <span className="text-[12px] text-[#727272] leading-4 whitespace-nowrap overflow-hidden text-ellipsis">
                {email}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
