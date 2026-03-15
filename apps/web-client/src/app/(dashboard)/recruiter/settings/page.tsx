"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2, FileText, Scale, Shield,
  CheckCircle2, AlertTriangle, Zap, Plus, Trash2,
  UserPlus, RefreshCw, ExternalLink,
} from "lucide-react";
import { getInitials } from "@/lib/recruiter-utils";

type Tab = "connect" | "roles" | "rubric" | "permissions";

// ─── Animation variants ───────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, delay: i * 0.055, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const tabVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } },
  exit:   { opacity: 0, y: -6, transition: { duration: 0.18 } },
};

// ─── Integration data ─────────────────────────────────────
const integrations = [
  { id: "greenhouse", label: "Greenhouse",      desc: "ATS sync",                 status: "connected",    syncedAt: "2m ago",  initial: "G", color: "#1f6b43",  bg: "#e8f5ee" },
  { id: "gcal",       label: "Google Calendar", desc: "Interview scheduling",      status: "connected",    syncedAt: "5m ago",  initial: "G", color: "#2563eb",  bg: "#eff6ff" },
  { id: "gmail",      label: "Gmail",           desc: "Automated outreach",        status: "disconnected", syncedAt: null,      initial: "M", color: "#dc2626",  bg: "#fef2f2" },
  { id: "handshake",  label: "Handshake",       desc: "Career fair platform",      status: "connected",    syncedAt: "1h ago",  initial: "H", color: "#0e3d27",  bg: "#e8f5ee" },
];

const agentPermissions = [
  { id: "create_note",         label: "Create candidate note",  enabled: true,  requiresApproval: false, desc: "Auto-log interview highlights" },
  { id: "add_tags",            label: "Add tags",               enabled: true,  requiresApproval: false, desc: "Categorize by skill or stage" },
  { id: "move_stage",          label: "Move stage",             enabled: true,  requiresApproval: false, desc: "Advance pipeline automatically" },
  { id: "draft_email",         label: "Draft email",            enabled: true,  requiresApproval: false, desc: "Generate follow-up copy" },
  { id: "schedule_interview",  label: "Schedule interview",     enabled: true,  requiresApproval: false, desc: "Book via Google Calendar" },
  { id: "send_rejection",      label: "Send rejection email",   enabled: false, requiresApproval: true,  desc: "Requires human approval" },
  { id: "send_offer",          label: "Send offer email",       enabled: false, requiresApproval: true,  desc: "Requires human approval" },
];

// ─── Toggle ───────────────────────────────────────────────
function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={enabled} aria-label={label}
      onClick={onChange}
      className="relative rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#1f6b43] focus:ring-offset-2 shrink-0"
      style={{ width: 42, height: 24, background: enabled ? "#1f6b43" : "#d1d5db" }}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-[3px] bg-white rounded-full shadow-sm"
        style={{ width: 18, height: 18, left: enabled ? 21 : 3 }}
      />
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────
function Toast({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="fixed bottom-6 right-6 flex items-center gap-2.5 bg-[#0e3d27] rounded-xl px-4 py-3 shadow-xl z-50"
    >
      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#6ee7b7]" />
      <span className="text-sm font-medium text-white">{message}</span>
    </motion.div>
  );
}

// ─── Section header ───────────────────────────────────────
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[15px] font-semibold text-[#111827]">{title}</h2>
      {action}
    </div>
  );
}

// ─── Connect Tab ──────────────────────────────────────────
function ConnectTab() {
  const searchParams = useSearchParams();
  const gcalParam = searchParams.get("gcal");

  const [integrationStates, setIntegrationStates] = useState(() => {
    const base = Object.fromEntries(integrations.map(i => [i.id, i.status === "connected"]));
    if (gcalParam === "connected") base.gcal = true;
    return base;
  });
  const [permissionStates, setPermissionStates] = useState(
    Object.fromEntries(agentPermissions.map(p => [p.id, p.enabled]))
  );
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (gcalParam === "connected") showToast("Google Calendar connected!");
    if (gcalParam === "error") showToast("Google Calendar connection failed — try again.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gcalParam]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleIntegrationToggle = (id: string, isConnected: boolean) => {
    if (id === "gcal" && !isConnected) {
      window.location.href = "/api/google-calendar";
      return;
    }
    setIntegrationStates(p => ({ ...p, [id]: !p[id] }));
    showToast("Connection updated");
  };

  return (
    <motion.div
      key="connect"
      variants={tabVariants}
      initial="hidden" animate="visible" exit="exit"
      className="grid grid-cols-2 gap-6"
    >
      {/* Integrations */}
      <div>
        <SectionHeader title="Integrations" />
        <div className="flex flex-col gap-2.5">
          {integrations.map((integration, i) => {
            const isConnected = integrationStates[integration.id];
            return (
              <motion.div
                key={integration.id}
                custom={i} variants={fadeUp} initial="hidden" animate="visible"
                className="group flex items-center justify-between bg-white border border-[#e2e8e5] rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md hover:border-[#c5e4d1] transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 transition-all duration-200"
                    style={{ background: isConnected ? integration.color : "#9ca3af" }}
                  >
                    {integration.initial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{integration.label}</p>
                    {isConnected ? (
                      <p className="text-xs font-medium" style={{ color: "#1f6b43" }}>
                        ● Connected · Synced {integration.syncedAt}
                      </p>
                    ) : (
                      <p className="text-xs text-[#9ca3af]">{integration.desc}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected && (
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[#f0fdf4] text-[#9ca3af] hover:text-[#1f6b43]">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <Toggle
                    enabled={isConnected}
                    onChange={() => handleIntegrationToggle(integration.id, isConnected)}
                    label={`Toggle ${integration.label}`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Agent Permissions */}
      <div>
        <SectionHeader
          title="Action Agent Permissions"
          action={
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border"
              style={{ background: "#e8f5ee", color: "#0e3d27", borderColor: "#c5e4d1" }}>
              <Zap className="w-2.5 h-2.5" />
              Nova AI
            </span>
          }
        />
        <div className="flex flex-col gap-2">
          {agentPermissions.map((permission, i) => {
            const isEnabled = permissionStates[permission.id];
            return (
              <motion.div
                key={permission.id}
                custom={i} variants={fadeUp} initial="hidden" animate="visible"
                className="flex items-center justify-between bg-white border border-[#e2e8e5] rounded-2xl px-4 py-3 shadow-sm hover:shadow-md hover:border-[#c5e4d1] transition-all duration-200"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-[#111827]">{permission.label}</p>
                    {permission.requiresApproval && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                        style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Approval required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9ca3af] mt-0.5">{permission.desc}</p>
                </div>
                <Toggle
                  enabled={isEnabled}
                  onChange={() => { setPermissionStates(p => ({ ...p, [permission.id]: !p[permission.id] })); showToast("Permission updated"); }}
                  label={`Toggle ${permission.label}`}
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>{toast && <Toast message={toast} />}</AnimatePresence>
    </motion.div>
  );
}

// ─── Roles Tab ────────────────────────────────────────────
const INITIAL_ROLES = [
  { id: 1, title: "SWE Intern",               department: "Engineering",    target: 3, status: "active" },
  { id: 2, title: "ML Engineer",              department: "AI Research",    target: 2, status: "active" },
  { id: 3, title: "Data Analyst Intern",      department: "Data",           target: 2, status: "active" },
  { id: 4, title: "Product Design Intern",    department: "Design",         target: 1, status: "active" },
  { id: 5, title: "DevOps Intern",            department: "Infrastructure", target: 1, status: "paused" },
  { id: 6, title: "Robotics Engineer Intern", department: "Hardware",       target: 2, status: "active" },
];

function RolesTab() {
  const [roles, setRoles] = useState(INITIAL_ROLES);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function handleDelete(id: number) {
    setDeletingId(id);
    setTimeout(() => { setRoles(prev => prev.filter(r => r.id !== id)); setDeletingId(null); }, 350);
  }

  return (
    <motion.div key="roles" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
      <SectionHeader
        title="Job Roles"
        action={
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90 hover:shadow-md"
            style={{ background: "linear-gradient(135deg, #0e3d27, #1f6b43)" }}>
            <Plus className="w-3.5 h-3.5" />
            Add Role
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total Roles",    value: roles.length,                               color: "#0e3d27", bg: "#e8f5ee" },
          { label: "Active",         value: roles.filter(r => r.status === "active").length,   color: "#1d4ed8", bg: "#eff6ff" },
          { label: "Target Hires",   value: roles.reduce((a, r) => a + r.target, 0),    color: "#92400e", bg: "#fef3c7" },
        ].map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={fadeUp} initial="hidden" animate="visible"
            className="rounded-2xl p-4 border border-[#e2e8e5]" style={{ background: stat.bg }}>
            <p className="text-xs font-medium text-[#6b7280] mb-1">{stat.label}</p>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <AnimatePresence mode="popLayout">
          {roles.map((role, i) => (
            <motion.div
              key={role.id}
              custom={i} variants={fadeUp} initial="hidden" animate="visible"
              exit={{ opacity: 0, x: 24, scale: 0.97, transition: { duration: 0.28 } }}
              layout
            >
              <div className="group flex items-center justify-between bg-white border border-[#e2e8e5] rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md hover:border-[#c5e4d1] transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ background: "#e8f5ee", color: "#0e3d27" }}>
                    {role.department.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{role.title}</p>
                    <p className="text-xs text-[#6b7280]">{role.department} · {role.target} target hire{role.target !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize"
                    style={role.status === "active"
                      ? { background: "#e8f5ee", color: "#0e3d27", borderColor: "#c5e4d1" }
                      : { background: "#f3f4f6", color: "#6b7280", borderColor: "#e5e7eb" }}>
                    {role.status}
                  </span>
                  <button
                    onClick={() => handleDelete(role.id)}
                    disabled={deletingId !== null}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-[#9ca3af] hover:text-red-500 hover:bg-red-50 disabled:pointer-events-none"
                    title="Delete role"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Rubric Tab ───────────────────────────────────────────
function AnimatedBar({ width, delay }: { width: number; delay: number }) {
  return (
    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "#e8f5ee" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: "linear-gradient(90deg, #0e3d27, #1f6b43 60%, #4ade80)" }}
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function RubricTab() {
  const criteria = [
    { id: "technical",  label: "Technical Skills",     weight: 40, icon: "⚙️" },
    { id: "comm",       label: "Communication",        weight: 20, icon: "💬" },
    { id: "culture",    label: "Culture Fit",          weight: 20, icon: "🤝" },
    { id: "leadership", label: "Leadership Potential", weight: 10, icon: "🏆" },
    { id: "research",   label: "Research / Projects",  weight: 10, icon: "🔬" },
  ];

  return (
    <motion.div key="rubric" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
      <SectionHeader
        title="Scoring Rubric"
        action={<span className="text-xs text-[#6b7280] font-medium">Weights total 100%</span>}
      />

      {/* Donut summary */}
      <div className="bg-gradient-to-br from-[#e8f5ee] to-[#f0fdf4] border border-[#c5e4d1] rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-[#0e3d27] mb-3">Weight Distribution</p>
        <div className="flex gap-3 flex-wrap">
          {criteria.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: "#1f6b43", opacity: 0.3 + (c.weight / 100) * 0.7 }} />
              <span className="text-xs text-[#374151]">{c.label}: <strong style={{ color: "#0e3d27" }}>{c.weight}%</strong></span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {criteria.map((c, i) => (
          <motion.div key={c.id} custom={i} variants={fadeUp} initial="hidden" animate="visible"
            className="bg-white border border-[#e2e8e5] rounded-2xl px-4 py-4 shadow-sm hover:shadow-md hover:border-[#c5e4d1] transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-base">{c.icon}</span>
                <p className="text-sm font-semibold text-[#111827]">{c.label}</p>
              </div>
              <span className="text-base font-bold" style={{ color: "#0e3d27" }}>{c.weight}%</span>
            </div>
            <AnimatedBar width={c.weight} delay={i * 0.08} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Permissions Tab ──────────────────────────────────────
function PermissionsTab() {
  const team = [
    { id: "jamie", name: "Jamie R.", role: "Senior Recruiter", access: "admin"  },
    { id: "sam",   name: "Sam T.",   role: "Recruiter",        access: "editor" },
    { id: "alex",  name: "Alex K.",  role: "Hiring Manager",   access: "viewer" },
    { id: "priya", name: "Priya M.", role: "HR Lead",          access: "admin"  },
  ];

  const accessConfig: Record<string, { bg: string; color: string; border: string }> = {
    admin:  { bg: "#e8f5ee", color: "#0e3d27", border: "#c5e4d1" },
    editor: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    viewer: { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
  };

  return (
    <motion.div key="permissions" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
      <SectionHeader
        title="Team Permissions"
        action={
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90 hover:shadow-md"
            style={{ background: "linear-gradient(135deg, #0e3d27, #1f6b43)" }}>
            <UserPlus className="w-3.5 h-3.5" />
            Invite Member
          </button>
        }
      />

      {/* Access level legend */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries(accessConfig).map(([key, style]) => (
          <span key={key} className="text-xs font-semibold px-2.5 py-1 rounded-full border capitalize"
            style={{ background: style.bg, color: style.color, borderColor: style.border }}>
            {key}
          </span>
        ))}
        <span className="text-xs text-[#9ca3af] self-center ml-1">access levels</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {team.map((member, i) => {
          const style = accessConfig[member.access];
          return (
            <motion.div key={member.id} custom={i} variants={fadeUp} initial="hidden" animate="visible"
              className="group flex items-center justify-between bg-white border border-[#e2e8e5] rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md hover:border-[#c5e4d1] transition-all duration-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "#e8f5ee", color: "#0e3d27" }}>
                  {getInitials(member.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{member.name}</p>
                  <p className="text-xs text-[#6b7280]">{member.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[#f0fdf4] text-[#9ca3af] hover:text-[#1f6b43]">
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize"
                  style={{ background: style.bg, color: style.color, borderColor: style.border }}>
                  {member.access}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main Settings Page ───────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("connect");

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "connect",     label: "Connect",     icon: Link2    },
    { key: "roles",       label: "Roles",       icon: FileText },
    { key: "rubric",      label: "Rubric",      icon: Scale    },
    { key: "permissions", label: "Permissions", icon: Shield   },
  ];

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-[26px] font-bold text-[#111827] leading-tight tracking-tight">Settings</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">Configure integrations, roles, scoring rubric, and team permissions</p>
      </motion.div>

      {/* Tab bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}
        className="flex gap-1 bg-[#f3f4f6] rounded-xl p-1 border border-[#e2e8e5]"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative flex items-center justify-center gap-2 flex-1 px-4 py-2 text-sm font-medium rounded-[10px] transition-colors duration-200 z-10"
              style={{ color: isActive ? "#ffffff" : "#6b7280" }}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-0 rounded-[10px]"
                  style={{ background: "linear-gradient(135deg, #0e3d27, #1f6b43)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <tab.icon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "connect"     && <Suspense fallback={null}><ConnectTab /></Suspense>}
        {activeTab === "roles"       && <RolesTab />}
        {activeTab === "rubric"      && <RubricTab />}
        {activeTab === "permissions" && <PermissionsTab />}
      </AnimatePresence>
    </div>
  );
}
