"use client";

import { useState } from "react";
import {
  Link2, FileText, Scale, Shield,
  CheckCircle2, AlertTriangle, Zap,
} from "lucide-react";
import { getInitials } from "@/lib/recruiter-utils";

type Tab = "connect" | "roles" | "rubric" | "permissions";

// ─── Integration data ─────────────────────────────────────
const integrations = [
  { id: "greenhouse", label: "Greenhouse",      status: "connected",    syncedAt: "2m ago",  initial: "G", color: "#1f6b43" },
  { id: "gcal",       label: "Google Calendar", status: "connected",    syncedAt: "5m ago",  initial: "G", color: "#2563eb" },
  { id: "gmail",      label: "Gmail",           status: "disconnected", syncedAt: null,      initial: "M", color: "#dc2626" },
  { id: "handshake",  label: "Handshake",       status: "connected",    syncedAt: "1h ago",  initial: "H", color: "#0e3d27" },
];

const agentPermissions = [
  { id: "create_note",         label: "Create candidate note",  enabled: true,  requiresApproval: false },
  { id: "add_tags",            label: "Add tags",               enabled: true,  requiresApproval: false },
  { id: "move_stage",          label: "Move stage",             enabled: true,  requiresApproval: false },
  { id: "draft_email",         label: "Draft email",            enabled: true,  requiresApproval: false },
  { id: "schedule_interview",  label: "Schedule interview",     enabled: true,  requiresApproval: false },
  { id: "send_rejection",      label: "Send rejection email",   enabled: false, requiresApproval: true },
  { id: "send_offer",          label: "Send offer email",       enabled: false, requiresApproval: true },
];

// ─── Toggle ───────────────────────────────────────────────
function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onChange}
      style={{ width: 40, height: 22, background: enabled ? "#1f6b43" : "#d1d5db" }}
      className="relative rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#1f6b43] focus:ring-offset-2 shrink-0"
    >
      <span
        style={{ width: 18, height: 18 }}
        className={`absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform duration-200 ${
          enabled ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-card border border-[#c5e4d1] rounded-xl px-4 py-3 shadow-lg z-50">
      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#1f6b43" }} />
      <span className="text-sm font-medium text-foreground">{message}</span>
    </div>
  );
}

// ─── Connect Tab ──────────────────────────────────────────
function ConnectTab() {
  const [integrationStates, setIntegrationStates] = useState(
    Object.fromEntries(integrations.map(i => [i.id, i.status === "connected"]))
  );
  const [permissionStates, setPermissionStates] = useState(
    Object.fromEntries(agentPermissions.map(p => [p.id, p.enabled]))
  );
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-6 w-full">
        {/* Integrations */}
        <div>
          <h2 className="text-[15px] font-semibold text-[#111827] mb-3">Integrations</h2>
          <div className="space-y-2.5">
            {integrations.map((integration) => {
              const isConnected = integrationStates[integration.id];
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between bg-card border border-[#e2e8e5] rounded-xl px-4 py-3.5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: isConnected ? integration.color : "#9ca3af" }}
                    >
                      {integration.initial}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#111827]">{integration.label}</p>
                      {isConnected ? (
                        <p className="text-xs font-medium" style={{ color: "#1f6b43" }}>
                          Connected · Synced {integration.syncedAt}
                        </p>
                      ) : (
                        <p className="text-xs text-[#9ca3af]">Not connected</p>
                      )}
                    </div>
                  </div>
                  <Toggle
                    enabled={isConnected}
                    onChange={() => { setIntegrationStates(p => ({ ...p, [integration.id]: !p[integration.id] })); showToast("Connection updated"); }}
                    label={`Toggle ${integration.label}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Agent Permissions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[15px] font-semibold text-[#111827]">Action Agent Permissions</h2>
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{ background: "#e8f5ee", color: "#0e3d27", borderColor: "#c5e4d1" }}>
              <Zap className="w-2.5 h-2.5" />
              Nova AI
            </span>
          </div>
          <div className="space-y-2">
            {agentPermissions.map((permission) => {
              const isEnabled = permissionStates[permission.id];
              return (
                <div
                  key={permission.id}
                  className="flex items-center justify-between bg-card border border-[#e2e8e5] rounded-xl px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-[#111827]">{permission.label}</p>
                    {permission.requiresApproval && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
                        style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Approval required
                      </span>
                    )}
                  </div>
                  <Toggle
                    enabled={isEnabled}
                    onChange={() => { setPermissionStates(p => ({ ...p, [permission.id]: !p[permission.id] })); showToast("Permission updated"); }}
                    label={`Toggle ${permission.label}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} />}
    </>
  );
}

// ─── Roles Tab ────────────────────────────────────────────
function RolesTab() {
  const roles = [
    { title: "SWE Intern",               department: "Engineering",     target: 3, status: "active" },
    { title: "ML Engineer",              department: "AI Research",     target: 2, status: "active" },
    { title: "Data Analyst Intern",      department: "Data",            target: 2, status: "active" },
    { title: "Product Design Intern",    department: "Design",          target: 1, status: "active" },
    { title: "DevOps Intern",            department: "Infrastructure",  target: 1, status: "paused" },
    { title: "Robotics Engineer Intern", department: "Hardware",        target: 2, status: "active" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-[#111827]">Job Roles</h2>
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
        >
          + Add Role
        </button>
      </div>
      <div className="space-y-2.5">
        {roles.map((role, i) => (
          <div key={i} className="flex items-center justify-between bg-card border border-[#e2e8e5] rounded-xl px-4 py-3.5 shadow-sm">
            <div>
              <p className="text-sm font-medium text-[#111827]">{role.title}</p>
              <p className="text-xs text-[#6b7280]">{role.department} · {role.target} target hires</p>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
              style={
                role.status === "active"
                  ? { background: "#e8f5ee", color: "#0e3d27", borderColor: "#c5e4d1" }
                  : { background: "#f3f4f6", color: "#6b7280", borderColor: "#e5e7eb" }
              }
            >
              {role.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rubric Tab ───────────────────────────────────────────
function RubricTab() {
  const criteria = [
    { label: "Technical Skills",      weight: 40 },
    { label: "Communication",         weight: 20 },
    { label: "Culture Fit",           weight: 20 },
    { label: "Leadership Potential",  weight: 10 },
    { label: "Research / Projects",   weight: 10 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-[#111827]">Scoring Rubric</h2>
        <span className="text-xs text-[#6b7280]">Weights must total 100%</span>
      </div>
      <div className="space-y-3">
        {criteria.map((c, i) => (
          <div key={i} className="bg-card border border-[#e2e8e5] rounded-xl px-4 py-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-sm font-medium text-[#111827]">{c.label}</p>
              <span className="text-sm font-bold" style={{ color: "#0e3d27" }}>{c.weight}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#e8f5ee" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${c.weight}%`, background: "linear-gradient(90deg, #0e3d27, #1f6b43)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Permissions Tab ──────────────────────────────────────
function PermissionsTab() {
  const team = [
    { name: "Jamie R.", role: "Senior Recruiter", access: "admin"  },
    { name: "Sam T.",   role: "Recruiter",        access: "editor" },
    { name: "Alex K.",  role: "Hiring Manager",   access: "viewer" },
    { name: "Priya M.", role: "HR Lead",          access: "admin"  },
  ];

  const accessStyle = (access: string) => {
    if (access === "admin")  return { background: "#e8f5ee", color: "#0e3d27", borderColor: "#c5e4d1" };
    if (access === "editor") return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
    return { background: "#f3f4f6", color: "#6b7280", borderColor: "#e5e7eb" };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-[#111827]">Team Permissions</h2>
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(171deg, #0e3d27 16.3%, #1f6b43 71.8%)" }}
        >
          + Invite Member
        </button>
      </div>
      <div className="space-y-2.5">
        {team.map((member, i) => (
          <div key={i} className="flex items-center justify-between bg-card border border-[#e2e8e5] rounded-xl px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "#e8f5ee", color: "#0e3d27" }}
              >
                {getInitials(member.name)}
              </div>
              <div>
                <p className="text-sm font-medium text-[#111827]">{member.name}</p>
                <p className="text-xs text-[#6b7280]">{member.role}</p>
              </div>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize"
              style={accessStyle(member.access)}
            >
              {member.access}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("connect");

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "connect",     label: "Connect",     icon: Link2   },
    { key: "roles",       label: "Roles",       icon: FileText },
    { key: "rubric",      label: "Rubric",      icon: Scale    },
    { key: "permissions", label: "Permissions", icon: Shield   },
  ];

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold text-[#111827] leading-tight">Settings</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">
          Configure integrations, roles, scoring rubric, and team permissions
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[#f7f7f7] rounded-xl p-1 border border-[#e2e8e5]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2 text-sm font-medium rounded-[10px] transition-colors"
            style={
              activeTab === tab.key
                ? { background: "#0e3d27", color: "#ffffff" }
                : { color: "#6b7280" }
            }
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "connect"     && <ConnectTab />}
        {activeTab === "roles"       && <RolesTab />}
        {activeTab === "rubric"      && <RubricTab />}
        {activeTab === "permissions" && <PermissionsTab />}
      </div>
    </div>
  );
}
