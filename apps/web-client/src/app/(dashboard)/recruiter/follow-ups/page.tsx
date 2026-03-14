"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mail, Search, CheckCheck, Clock } from "lucide-react";
import { getInitials, AVATAR_COLORS } from "@/lib/recruiter-utils";

// ─── Types ────────────────────────────────────────────────
interface Message {
  id: string;
  text: string;
  from: "recruiter" | "candidate";
  ts: number; // epoch ms
}

interface ConversationStore {
  [candidateId: string]: Message[];
}

const STORAGE_KEY = "fairsignal:followup:conversations";

function loadConversations(): ConversationStore {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}

function saveConversations(store: ConversationStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - ts) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── Avatar ───────────────────────────────────────────────
function Avatar({ name, index, size = 10 }: { name: string; index: number; size?: number }) {
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ background: bg, fontSize: size <= 8 ? 11 : 13 }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function FollowUpsPage() {
  const trpc = useTRPC();
  const { data: candidates, isLoading } = useQuery(trpc.recruiter.getCandidates.queryOptions());

  const [conversations, setConversations] = useState<ConversationStore>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => { setConversations(loadConversations()); }, []);

  // Scroll to bottom when conversation changes or new message sent
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId, conversations]);

  const sendMessage = useCallback(() => {
    if (!selectedId || !draft.trim()) return;
    const msg: Message = { id: crypto.randomUUID(), text: draft.trim(), from: "recruiter", ts: Date.now() };
    setConversations(prev => {
      const updated = { ...prev, [selectedId]: [...(prev[selectedId] ?? []), msg] };
      saveConversations(updated);
      return updated;
    });
    setDraft("");
  }, [selectedId, draft]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#1f6b43] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allCandidates = candidates ?? [];

  // Sort by most recent message (candidates with messages first, then by message time desc)
  const sortedCandidates = [...allCandidates].sort((a, b) => {
    const aLast = conversations[a.id]?.at(-1)?.ts ?? 0;
    const bLast = conversations[b.id]?.at(-1)?.ts ?? 0;
    return bLast - aLast;
  });

  const filtered = sortedCandidates.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.role ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const selected = allCandidates.find(c => c.id === selectedId);
  const selectedIndex = allCandidates.findIndex(c => c.id === selectedId);
  const thread = selectedId ? (conversations[selectedId] ?? []) : [];

  return (
    <div className="flex gap-0 h-[calc(100vh-72px)]">

      {/* ── LEFT: Conversation list ── */}
      <div className="w-[320px] shrink-0 flex flex-col border-r border-[#e2e8e5] bg-white">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-[#e2e8e5]">
          <h1 className="text-[17px] font-bold text-[#111827] mb-3">Follow-ups</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search candidates..."
              className="w-full bg-[#f7f7f7] border border-[#e2e8e5] rounded-xl pl-8 pr-3 py-2 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#1f6b43] transition-colors"
            />
          </div>
        </div>

        {/* Conversation cards */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {filtered.map((c, i) => {
              const msgs = conversations[c.id] ?? [];
              const lastMsg = msgs.at(-1);
              const isSelected = c.id === selectedId;
              const hasMessages = msgs.length > 0;

              return (
                <motion.button
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setSelectedId(isSelected ? null : c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#f3f4f6] text-left transition-colors"
                  style={{ background: isSelected ? "#f0fdf4" : "white" }}
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {getInitials(c.name)}
                    </div>
                    {hasMessages && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#1f6b43] rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-semibold text-[#111827] truncate">{c.name}</p>
                      {lastMsg && (
                        <span className="text-[10px] text-[#9ca3af] shrink-0 ml-1">{formatTime(lastMsg.ts)}</span>
                      )}
                    </div>
                    <p className="text-xs text-[#6b7280] truncate">
                      {lastMsg ? (
                        <span className="flex items-center gap-1">
                          {lastMsg.from === "recruiter" && <CheckCheck className="w-3 h-3 shrink-0 text-[#1f6b43]" />}
                          {lastMsg.text}
                        </span>
                      ) : (
                        <span className="text-[#9ca3af]">{c.role ?? "No messages yet"}</span>
                      )}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ── RIGHT: Thread ── */}
      <div className="flex-1 flex flex-col bg-[#f7f7f7]">
        {selected ? (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-white border-b border-[#e2e8e5] shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                style={{ background: AVATAR_COLORS[selectedIndex % AVATAR_COLORS.length] }}>
                {getInitials(selected.name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827]">{selected.name}</p>
                <p className="text-xs text-[#6b7280]">{selected.role} · {selected.school}</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                style={{ background: "#e8f5ee", color: "#0e3d27", borderColor: "#c5e4d1" }}>
                <span>Fit score</span>
                <span className="font-bold">{selected.fitScore ?? "—"}</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {thread.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center pb-8">
                  <Mail className="w-10 h-10 text-[#d1fae5] mb-3" />
                  <p className="text-sm font-medium text-[#6b7280]">Start the conversation</p>
                  <p className="text-xs text-[#9ca3af] mt-1">Send a follow-up message to {selected.name.split(" ")[0]}</p>
                </div>
              ) : (
                <>
                  {thread.map((msg, i) => {
                    const isRecruiter = msg.from === "recruiter";
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.22, delay: i === thread.length - 1 ? 0 : 0 }}
                        className={`flex ${isRecruiter ? "justify-end" : "justify-start"}`}
                      >
                        <div className="max-w-[72%]">
                          <div
                            className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm"
                            style={isRecruiter
                              ? { background: "linear-gradient(135deg, #0e3d27, #1f6b43)", color: "white", borderBottomRightRadius: 6 }
                              : { background: "white", color: "#111827", border: "1px solid #e2e8e5", borderBottomLeftRadius: 6 }
                            }
                          >
                            {msg.text}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 ${isRecruiter ? "justify-end" : "justify-start"}`}>
                            <span className="text-[10px] text-[#9ca3af]">{formatTime(msg.ts)}</span>
                            {isRecruiter && <CheckCheck className="w-3 h-3 text-[#1f6b43]" />}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Suggested messages */}
            {thread.length === 0 && (
              <div className="px-5 pb-2 flex gap-2 flex-wrap shrink-0">
                {[
                  `Hi ${selected.name.split(" ")[0]}, great meeting you at the fair!`,
                  "We'd love to schedule a follow-up call.",
                  "Please find next steps attached.",
                ].map(s => (
                  <button key={s} onClick={() => setDraft(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-[#c5e4d1] bg-white text-[#1f6b43] hover:bg-[#f0fdf4] transition-colors font-medium truncate max-w-[220px]">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 bg-white border-t border-[#e2e8e5] shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${selected.name.split(" ")[0]}…`}
                  rows={1}
                  className="flex-1 bg-[#f7f7f7] border border-[#e2e8e5] rounded-2xl px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#1f6b43] resize-none transition-colors leading-relaxed"
                  style={{ minHeight: 42, maxHeight: 120 }}
                />
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={sendMessage}
                  disabled={!draft.trim()}
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                  style={{ background: draft.trim() ? "linear-gradient(135deg, #0e3d27, #1f6b43)" : "#e5e7eb" }}
                >
                  <Send className="w-4 h-4" style={{ color: draft.trim() ? "white" : "#9ca3af" }} />
                </motion.button>
              </div>
              <p className="text-[10px] text-[#9ca3af] mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-[#e8f5ee] flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 text-[#1f6b43]" />
            </div>
            <p className="text-base font-semibold text-[#111827] mb-1">Select a candidate</p>
            <p className="text-sm text-[#6b7280] max-w-[260px]">
              Pick a conversation from the left to send a follow-up message
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-xs text-[#9ca3af]">
              <Clock className="w-3.5 h-3.5" />
              Messages are saved locally across sessions
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
