"use client";

import { useState } from "react";
import {
  Link2, FileText, Scale, Shield,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import { getInitials } from "@/lib/recruiter-utils";

type Tab = "connect" | "roles" | "rubric" | "permissions";

// ─── Integration data ─────────────────────────────────────
const integrations = [
  { id: "greenhouse", label: "Greenhouse", status: "connected", syncedAt: "2m ago", color: "bg-emerald-600" },
  { id: "gcal", label: "Google Calendar", status: "connected", syncedAt: "5m ago", color: "bg-blue-500" },
  { id: "gmail", label: "Gmail", status: "disconnected", syncedAt: null, color: "bg-muted" },
  { id: "handshake", label: "Handshake", status: "connected", syncedAt: "1h ago", color: "bg-emerald-500" },
];

const agentPermissions = [
  { id: "create_note", label: "Create candidate note", enabled: true, requiresApproval: false },
  { id: "add_tags", label: "Add tags", enabled: true, requiresApproval: false },
  { id: "move_stage", label: "Move stage", enabled: true, requiresApproval: false },
  { id: "draft_email", label: "Draft email", enabled: true, requiresApproval: false },
  { id: "schedule_interview", label: "Schedule interview", enabled: true, requiresApproval: false },
  { id: "send_rejection", label: "Send rejection email", enabled: false, requiresApproval: true },
  { id: "send_offer", label: "Send offer email", enabled: false, requiresApproval: true },
];

// ─── Toggle component ─────────────────────────────────────
function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onChange}
      style={{ width: 40, height: 22 }}
      className={`relative rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shrink-0 ${
        enabled ? "bg-primary" : "bg-muted-foreground/30"
      }`}
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
    <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 shadow-lg z-50">
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
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

  const toggleIntegration = (id: string) => {
    setIntegrationStates(prev => ({ ...prev, [id]: !prev[id] }));
    showToast("Connection updated");
  };

  const togglePermission = (id: string) => {
    setPermissionStates(prev => ({ ...prev, [id]: !prev[id] }));
    showToast("Permission updated");
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-8 w-full">
        {/* Integrations */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">Integrations</h2>
          <div className="space-y-3">
            {integrations.map((integration) => {
              const isConnected = integrationStates[integration.id];
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3.5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${isConnected ? integration.color : "bg-muted"} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {integration.label[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{integration.label}</p>
                      {isConnected ? (
                        <p className="text-xs text-emerald-600">Connected · Synced {integration.syncedAt}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not connected</p>
                      )}
                    </div>
                  </div>
                  <Toggle enabled={isConnected} onChange={() => toggleIntegration(integration.id)} label={`Toggle ${integration.label}`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Agent Permissions */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">Action Agent Permissions</h2>
          <div className="space-y-2.5">
            {agentPermissions.map((permission) => {
              const isEnabled = permissionStates[permission.id];
              return (
                <div
                  key={permission.id}
                  className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-foreground">{permission.label}</p>
                    {permission.requiresApproval && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Approval required
                      </span>
                    )}
                  </div>
                  <Toggle enabled={isEnabled} onChange={() => togglePermission(permission.id)} label={`Toggle ${permission.label}`} />
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
    { title: "SWE Intern", department: "Engineering", target: 3, status: "active" },
    { title: "ML Engineer", department: "AI Research", target: 2, status: "active" },
    { title: "Data Analyst Intern", department: "Data", target: 2, status: "active" },
    { title: "Product Design Intern", department: "Design", target: 1, status: "active" },
    { title: "DevOps Intern", department: "Infrastructure", target: 1, status: "paused" },
    { title: "Robotics Engineer Intern", department: "Hardware", target: 2, status: "active" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Job Roles</h2>
        <button className="text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
          + Add Role
        </button>
      </div>
      <div className="space-y-2.5">
        {roles.map((role, i) => (
          <div key={i} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3.5 shadow-sm">
            <div>
              <p className="text-sm font-medium text-foreground">{role.title}</p>
              <p className="text-xs text-muted-foreground">{role.department} · {role.target} target hires</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              role.status === "active"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-muted text-muted-foreground border-border"
            }`}>
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
    { label: "Technical Skills", weight: 40 },
    { label: "Communication", weight: 20 },
    { label: "Culture Fit", weight: 20 },
    { label: "Leadership Potential", weight: 10 },
    { label: "Research / Projects", weight: 10 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Scoring Rubric</h2>
        <span className="text-xs text-muted-foreground">Weights must total 100%</span>
      </div>
      <div className="space-y-3">
        {criteria.map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl px-4 py-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <span className="text-sm font-bold text-primary">{c.weight}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${c.weight}%` }}
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
    { name: "Jamie R.", role: "Senior Recruiter", access: "admin" },
    { name: "Sam T.", role: "Recruiter", access: "editor" },
    { name: "Alex K.", role: "Hiring Manager", access: "viewer" },
    { name: "Priya M.", role: "HR Lead", access: "admin" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Team Permissions</h2>
        <button className="text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
          + Invite Member
        </button>
      </div>
      <div className="space-y-2.5">
        {team.map((member, i) => (
          <div key={i} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {getInitials(member.name)}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${
              member.access === "admin"
                ? "bg-primary/10 text-primary border-primary/20"
                : member.access === "editor"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-muted text-muted-foreground border-border"
            }`}>
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
    { key: "connect", label: "Connect", icon: Link2 },
    { key: "roles", label: "Roles", icon: FileText },
    { key: "rubric", label: "Rubric", icon: Scale },
    { key: "permissions", label: "Permissions", icon: Shield },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Connect & Configure</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Set up your ATS integrations and fair rubric
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 bg-card border border-border rounded-xl overflow-hidden w-full">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center justify-center gap-2 flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-r border-border last:border-r-0 ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "connect" && <ConnectTab />}
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "rubric" && <RubricTab />}
        {activeTab === "permissions" && <PermissionsTab />}
      </div>
    </div>
  );
}