"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";

// All CSS scoped to .lp to avoid conflicting with app globals.css / Tailwind variables
const globalStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

  html { scroll-behavior: smooth; }

  .lp, .lp * { box-sizing: border-box; }
  .lp {
    --lp-bg: #EDF3EE;
    --lp-bg-card: rgba(255,255,255,0.64);
    --lp-fg: #0D2318;
    --lp-accent: #3E7A52;
    --lp-accent-lt: #7AAE8A;
    --lp-accent-xs: rgba(122,174,138,0.13);
    --lp-muted: #527060;
    --lp-border: rgba(62,122,82,0.16);
    --lp-shadow: 0 4px 26px rgba(13,35,24,0.07);
    background: #EDF3EE !important;
    color: #0D2318 !important;
    font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif !important;
    -webkit-font-smoothing: antialiased;
    line-height: 1.6;
    min-height: 100vh;
  }
  .lp .serif { font-family: 'Playfair Display', ui-serif, Georgia, serif !important; }
  .lp ::-webkit-scrollbar { width: 5px; }
  .lp ::-webkit-scrollbar-track { background: #EDF3EE; }
  .lp ::-webkit-scrollbar-thumb { background: #7AAE8A; border-radius: 99px; }

  .lp.grain-wrap::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 9998; opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 128px;
  }

  @keyframes orbDrift {
    0%,100% { transform: translate(-50%,-50%) scale(1) rotate(0deg); }
    40% { transform: translate(-50%,-50%) scale(1.1) rotate(150deg); }
    70% { transform: translate(-50%,-50%) scale(0.93) rotate(260deg); }
  }

  .lp .btn-primary {
    background: linear-gradient(90deg, #1A4A2E 0%, #3E7A52 48%, #1A4A2E 100%);
    background-size: 220% auto; color: #fff !important; border: none; border-radius: 99px;
    padding: 13px 30px; font-size: 14px; font-weight: 600; cursor: pointer;
    font-family: 'DM Sans', sans-serif; transition: background-position .55s ease, box-shadow .3s, transform .2s;
  }
  .lp .btn-primary:hover { background-position: right center; box-shadow: 0 8px 30px rgba(62,122,82,.38); transform: translateY(-2px); }

  .lp .btn-secondary {
    background: transparent !important; border: 1.5px solid #9DBDAA; border-radius: 99px;
    padding: 13px 30px; font-size: 14px; font-weight: 500; color: #0D2318 !important;
    cursor: pointer; font-family: 'DM Sans', sans-serif; transition: border-color .25s, background .25s;
  }
  .lp .btn-secondary:hover { border-color: #3E7A52; background: rgba(122,174,138,.07) !important; }

  .lp .lift { transition: transform .3s ease, box-shadow .3s ease; }
  .lp .lift:hover { transform: translateY(-5px); box-shadow: 0 20px 44px rgba(13,35,24,.10); }

  .lp .toggle-pill { display: inline-flex; border-radius: 99px; padding: 4px; background: rgba(255,255,255,0.6); border: 1px solid rgba(62,122,82,0.16); }
  .lp .toggle-pill button { border: none; border-radius: 99px; padding: 8px 22px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background .25s, color .25s, box-shadow .25s; }
  .lp .toggle-pill button.active { background: #0D2318; color: #EDF3EE; box-shadow: 0 2px 10px rgba(13,35,24,.15); }
  .lp .toggle-pill button:not(.active) { background: transparent; color: #527060; }

  .lp .rflow-node { cursor: default; }

  .lp .modal-back { position: fixed; inset: 0; background: rgba(13,35,24,0.48); backdrop-filter: blur(7px); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; }

  @keyframes marquee-left {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes marquee-right {
    0%   { transform: translateX(-50%); }
    100% { transform: translateX(0); }
  }
  .lp .marquee-track-left { display: flex; width: max-content; animation: marquee-left 60s linear infinite; }
`;

const LOGO_URL = "https://www.figma.com/api/mcp/asset/711a3b98-0750-4e7c-9876-6f715b363504";

const C = {
  bg: "#EDF3EE", bgCard: "rgba(255,255,255,0.64)", fg: "#0D2318",
  accent: "#3E7A52", accentLt: "#7AAE8A", accentXs: "rgba(122,174,138,0.13)",
  muted: "#527060", border: "rgba(62,122,82,0.16)", shadow: "0 4px 26px rgba(13,35,24,0.07)",
};

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.56, ease: [0.22, 1, 0.36, 1] as const } } };

function Reveal({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={fadeUp} transition={{ delay }} style={style}>
      {children}
    </motion.div>
  );
}

const PlayIcon = () => (
  <svg width="58" height="58" viewBox="0 0 58 58" fill="none">
    <circle cx="29" cy="29" r="29" fill="rgba(13,35,24,0.82)" />
    <polygon points="23,18 44,29 23,40" fill="#EDF3EE" />
  </svg>
);
const Chk = ({ size = 14, color = "#3E7A52" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M2 7l3.5 3.5L12 3.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Xmark = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="#B25040" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

function TimeBar({ label, pct, rangeLabel, color, delay = 0 }: { label: string; pct: number; rangeLabel: string; color: string; delay?: number }) {
  const ref = useRef(null); const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12, color: C.muted, fontWeight: 500 }}>
        <span>{label}</span><span style={{ fontWeight: 600, color: C.fg }}>{rangeLabel}</span>
      </div>
      <div style={{ height: 9, borderRadius: 99, background: "#C8DDD0", overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={inView ? { width: `${pct}%` } : { width: 0 }}
          transition={{ duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: "100%", borderRadius: 99, background: color }} />
      </div>
    </div>
  );
}

function ErrorRing({ pct, color }: { pct: number; color: string }) {
  const ref = useRef(null); const inView = useInView(ref, { once: true });
  const r = 27; const circ = 2 * Math.PI * r;
  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="66" height="66" viewBox="0 0 66 66">
        <circle cx="33" cy="33" r={r} fill="none" stroke="#C4DCC8" strokeWidth="6" />
        <motion.circle cx="33" cy="33" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={inView ? { strokeDashoffset: circ * (1 - pct / 100) } : {}}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "center", transform: "rotate(-90deg)" }} />
        <text x="33" y="37" textAnchor="middle" fontSize="12" fontWeight="700" fill={C.fg}>{pct}%</text>
      </svg>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.fg }}>Error reduction</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>email · phone · dates · repeated fields</div>
      </div>
    </div>
  );
}

function BatchViz() {
  const ref = useRef(null); const inView = useInView(ref, { once: true }); const active = [1, 4, 7];
  return (
    <div ref={ref}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginBottom: 10 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.78 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ delay: i * 0.055, duration: 0.35 }}
            style={{ height: 29, borderRadius: 7, background: active.includes(i) ? "linear-gradient(135deg,#7AAE8A,#3E7A52)" : "#C8DDD0", border: active.includes(i) ? "none" : "1px solid #B0CEB8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {active.includes(i) && <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.22 }} style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
          </motion.div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ background: "#CBE8D0", borderRadius: 99, padding: "3px 10px", fontSize: 11, color: "#1A5A2A", fontWeight: 600 }}>✓ 20–30 min / batch</span>
        <span style={{ background: "#E4EDE6", borderRadius: 99, padding: "3px 10px", fontSize: 11, color: C.muted, textDecoration: "line-through" }}>1–3 hrs sequential</span>
      </div>
    </div>
  );
}

function TabCollapseViz() {
  const ref = useRef(null); const inView = useInView(ref, { once: true });
  const tabs = ["Job Post", "App Form", "Cover Letter", "ATS Portal", "Follow-up"];
  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {tabs.map((t, i) => (
          <motion.div key={t} initial={{ opacity: 1, x: 0 }} animate={inView ? { opacity: 0.28, x: -7, scale: 0.88 } : { opacity: 1 }} transition={{ delay: 0.22 + i * 0.1, duration: 0.42 }}
            style={{ background: "#C8DDD0", borderRadius: 7, padding: "3px 9px", fontSize: 10.5, color: C.muted, border: "1px solid #B0CEB8" }}>{t}</motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.82 }} style={{ fontSize: 18, color: C.accent }}>→</motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.92 }}
        style={{ background: C.accentXs, border: "1.5px solid rgba(122,174,138,.42)", borderRadius: 11, padding: "10px 13px", fontSize: 11, fontWeight: 600, color: C.fg, textAlign: "center" }}>
        <div style={{ fontSize: 17, marginBottom: 2 }}>🔗</div>One Workflow
        <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 400, marginTop: 2 }}>job → form → follow-up</div>
      </motion.div>
    </div>
  );
}

function StopwatchTile() {
  const ref = useRef(null); const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} style={{ display: "flex", gap: 9, alignItems: "stretch" }}>
      <motion.div initial={{ opacity: 0, scale: 0.82 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.52 }}
        style={{ flex: 1, background: "linear-gradient(135deg,#7AAE8A,#2E6A42)", borderRadius: 13, padding: "13px 9px", textAlign: "center", color: "#fff" }}>
        <div className="serif" style={{ fontSize: 24, fontWeight: 700 }}>60–90s</div>
        <div style={{ fontSize: 10, opacity: 0.88, marginTop: 3 }}>AI triage time</div>
      </motion.div>
      <div style={{ display: "flex", alignItems: "center", color: "#8A9A8A", fontSize: 13 }}>vs</div>
      <motion.div initial={{ opacity: 0, scale: 0.82 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.52, delay: 0.13 }}
        style={{ flex: 1, background: "#DAE8DC", borderRadius: 13, padding: "13px 9px", textAlign: "center", border: "1px solid #C0D8C4" }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: "#8A6A60", textDecoration: "line-through" }}>5–10 min</div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>manual review</div>
      </motion.div>
    </div>
  );
}

function EvidenceViz() {
  const ref = useRef(null); const inView = useInView(ref, { once: true });
  const srcs = [{ l: "LinkedIn", c: "#0A66C2" }, { l: "GitHub", c: "#24292F" }, { l: "Web", c: "#3E7A52" }, { l: "Resume", c: "#C25010" }, { l: "Notes", c: "#7A5AC2" }, { l: "Twitter", c: "#1DA1F2" }];
  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {srcs.map((s, i) => (
          <motion.div key={s.l} initial={{ opacity: 1 }} animate={inView ? { opacity: 0.25, scale: 0.8 } : {}} transition={{ delay: 0.16 + i * 0.09, duration: 0.38 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ width: 31, height: 31, borderRadius: 9, background: s.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: "#fff" }}>{s.l.slice(0, 2)}</div>
              <span style={{ fontSize: 8, color: C.muted, fontWeight: 500 }}>{s.l}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ delay: 0.8 }} style={{ fontSize: 15, color: C.accent }}>→</motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.9 }}
        style={{ background: C.accentXs, border: "1.5px solid rgba(122,174,138,.38)", borderRadius: 11, padding: "10px 13px", fontSize: 11, fontWeight: 600, color: C.fg, minWidth: 110 }}>
        <div style={{ fontSize: 14, marginBottom: 3 }}>📦</div>Evidence Packet
        <div style={{ fontSize: 9.5, color: C.muted, fontWeight: 400, marginTop: 2 }}>links · snapshots · brief</div>
      </motion.div>
    </div>
  );
}

function ATSViz() {
  const ref = useRef(null); const inView = useInView(ref, { once: true });
  const tools = [
    { l: "Greenhouse", src: "/logos/greenhouse.png" },
    { l: "Lever",      src: "/logos/lever.png"      },
    { l: "Workday",    src: "/logos/workday.png"     },
    { l: "Ashby",      src: "/logos/ashby.png"       },
  ];
  return (
    <div ref={ref}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        {tools.map((t, i) => (
          <motion.div key={t.l} initial={{ opacity: 0, y: 6 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: i * 0.09 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(62,122,82,0.15)", display: "flex", alignItems: "center", justifyContent: "center", padding: 5 }}>
                <img src={t.src} alt={t.l} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
              <span style={{ fontSize: 8, color: C.muted, fontWeight: 500 }}>{t.l}</span>
            </div>
          </motion.div>
        ))}
        <motion.span initial={{ opacity: 0, scale: 0.7 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ delay: 0.42 }}
          style={{ background: "linear-gradient(135deg,#7AAE8A,#3E7A52)", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 99, padding: "3px 9px", letterSpacing: "0.04em" }}>
          AUTO-ADAPT …
        </motion.span>
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>Reducing repetitive steps by <strong style={{ color: C.accent }}>30–60%</strong></div>
    </div>
  );
}

// ── Agent Flowchart (candidate side) ─────────────────────────────────────────
function AgentFlowchart() {
  const ref = useRef(null); const inView = useInView(ref, { once: true, margin: "-50px" });
  const W = 780; const H = 390;
  const cx0 = 88; const cx1 = 264; const cx2 = 468; const cx3 = 664;
  const ry = [80, 195, 310]; const agY = 195;
  const nW = 144; const nH = 56; const aW = 172; const aH = 66;
  const iNodes = [{ id: "Resume", icon: "📄" }, { id: "Job Desc", icon: "📋" }, { id: "User Profile", icon: "🤝" }];
  const pNodes = [{ id: "JD Analyzer", icon: "🔍" }, { id: "Skill Matcher", icon: "🎯" }, { id: "Resume Tailor", icon: "✨" }];
  const oNodes = [{ id: "Submit App", icon: "🚀" }, { id: "Confirmation", icon: "✅" }, { id: "Book Chat Slot", icon: "📅" }];

  const paths: { d: string; base: number }[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x1 = cx0 + nW / 2, y1 = ry[i], x2 = cx1 - nW / 2, y2 = ry[j], mx = (x1 + x2) / 2;
    paths.push({ d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, base: i * 0.06 + j * 0.04 });
  }
  for (let j = 0; j < 3; j++) {
    const x1 = cx1 + nW / 2, y1 = ry[j], x2 = cx2 - aW / 2, y2 = agY, mx = (x1 + x2) / 2;
    paths.push({ d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, base: 0.5 + j * 0.1 });
  }
  for (let k = 0; k < 3; k++) {
    const x1 = cx2 + aW / 2, y1 = agY, x2 = cx3 - nW / 2, y2 = ry[k], mx = (x1 + x2) / 2;
    paths.push({ d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, base: 1.0 + k * 0.12 });
  }

  interface FNProps { cx: number; cy: number; wide?: boolean; label: string; icon: string; acc: string; idx?: number }
  const FN = ({ cx, cy, wide, label, icon, acc, idx }: FNProps) => {
    const w = wide ? aW : nW, h = wide ? aH : nH;
    return (
      <motion.g initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: (idx || 0) * 0.1, duration: 0.44 }}>
        <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="11" fill="rgba(255,255,255,0.92)" stroke={acc} strokeWidth="1.6" />
        <rect x={cx - w / 2} y={cy - h / 2 + 4} width="4" height={h - 8} rx="2" fill={acc} opacity="0.85" />
        <text x={cx + 5} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={wide ? "14.5" : "12.5"} fontWeight={wide ? "700" : "600"} fontFamily="'DM Sans',sans-serif" fill="#0D2318">{icon} {label}</text>
      </motion.g>
    );
  };

  const chips = ["Fit Ranker (pick best roles)", "Field Mapper (reduce copy/paste errors)", "Safe-stop review (human before submit)", "Follow-up drafts (thank-you + next steps)"];
  return (
    <div ref={ref} style={{ background: "rgba(255,255,255,0.56)", borderRadius: 22, border: "1px solid rgba(62,122,82,0.16)", padding: "22px 14px 18px", boxShadow: C.shadow, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 22, zIndex: 0, opacity: 0.38, backgroundImage: "linear-gradient(rgba(62,122,82,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(62,122,82,.08) 1px,transparent 1px)", backgroundSize: "26px 26px" }} />
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ position: "relative", zIndex: 2, display: "block", overflow: "visible" }}>
        <defs>
          <marker id="arr-c" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto">
            <path d="M0,1 L5.5,3 L0,5 Z" fill="rgba(122,174,138,0.5)" />
          </marker>
        </defs>
        {([["INPUTS", cx0, "#7B68EE"], ["AI PROCESSING", cx1, "#7B68EE"], ["OUTPUTS", cx3, "#3E7A52"]] as [string, number, string][]).map(([l, x, clr]) => (
          <text key={l} x={x} y={H - 8} textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="'DM Sans',sans-serif" letterSpacing="0.09em" fill={clr} opacity="0.85">{l}</text>
        ))}
        {paths.map((p, i) => <path key={`cp-${i}`} d={p.d} fill="none" stroke="rgba(122,174,138,0.2)" strokeWidth="1.3" markerEnd="url(#arr-c)" />)}
        {inView && paths.map((p, i) => (
          <motion.circle key={`cd-${i}`} r="3.2" fill="#7AAE8A"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.85, 0.85, 0], offsetDistance: ["0%", "0%", "50%", "100%", "100%"] } as never}
            style={{ offsetPath: `path("${p.d}")`, offsetRotate: "0deg" } as React.CSSProperties}
            transition={{ delay: (p.base % 2.5) + 0.4, duration: 1.9, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
          />
        ))}
        {iNodes.map((n, i) => <FN key={n.id} cx={cx0} cy={ry[i]} label={n.id} icon={n.icon} acc="#7B68EE" idx={i} />)}
        {pNodes.map((n, i) => <FN key={n.id} cx={cx1} cy={ry[i]} label={n.id} icon={n.icon} acc="#7B68EE" idx={3 + i} />)}
        <FN cx={cx2} cy={agY} wide label="Nova Act Agent" icon="🤖" acc="#3E7A52" idx={7} />
        {oNodes.map((n, i) => <FN key={n.id} cx={cx3} cy={ry[i]} label={n.id} icon={n.icon} acc="#3E7A52" idx={8 + i} />)}
      </svg>
      <div style={{ position: "relative", zIndex: 3, marginTop: 14, display: "flex", flexWrap: "wrap", gap: 7 }}>
        {chips.map(c => <span key={c} style={{ background: C.accentXs, border: "1px solid rgba(62,122,82,0.22)", borderRadius: 99, padding: "4px 12px", fontSize: 10.5, color: C.accent, fontWeight: 500 }}>{c}</span>)}
      </div>
    </div>
  );
}

// ── Recruiter Flowchart ───────────────────────────────────────────────────────
function RecruiterFlowchart({ onRewardClick }: { onRewardClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const W = 780; const H = 430;
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tipArrowRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const descriptions: Record<string, string> = {
    candEnter:    "Intake candidate and start automated screening + routing workflow.",
    microScreen:  "Score fit, identify gaps, flag risk, and rank priority.",
    smartRouter:  "Route candidates into lanes based on score, role, and risk.",
    recruiterNow: "Surface top candidates instantly for recruiter attention and action.",
    quickScreen:  "Generate ATS-ready brief: strengths, gaps, questions, next steps.",
    redirectLane: "Triage low-fit candidates with polite guidance and alternate roles.",
    novaAgent:    "Take actions across ATS: update stages, add notes, schedule steps.",
    atsSync:      "Sync evidence packet, scores, and decisions into Greenhouse.",
    interview:    "Auto-schedule interview, confirm availability, and create calendar event.",
    rewardSig:    "Learn from recruiter outcomes to improve scoring and routing.",
  };

  const N: Record<string, { cx: number; cy: number; w: number; h: number; label: string; sub: string; icon: string; ck: string }> = {
    candEnter:    { cx: 85,  cy: 205, w: 134, h: 48, label: "Candidate Enters",  sub: "Career Fair Queue",   icon: "🧑", ck: "blue"   },
    microScreen:  { cx: 274, cy: 110, w: 150, h: 48, label: "AI Micro-Screen",   sub: "Score & Risk Eval",   icon: "🧠", ck: "purple" },
    smartRouter:  { cx: 274, cy: 305, w: 142, h: 48, label: "Smart Router",      sub: "Lane Assignment",     icon: "⚡", ck: "purple" },
    recruiterNow: { cx: 464, cy: 58,  w: 142, h: 46, label: "Recruiter Now",     sub: "High Priority",       icon: "⭐", ck: "green"  },
    quickScreen:  { cx: 464, cy: 172, w: 140, h: 46, label: "Quick Screen",      sub: "Auto-Evaluate",       icon: "⚡", ck: "blue"   },
    redirectLane: { cx: 464, cy: 295, w: 140, h: 46, label: "Redirect Lane",     sub: "Low-Fit Triage",      icon: "↩",  ck: "amber"  },
    novaAgent:    { cx: 464, cy: 390, w: 140, h: 46, label: "Nova Act Agent",    sub: "ATS Automation",      icon: "🤖", ck: "purple" },
    atsSync:      { cx: 660, cy: 115, w: 130, h: 46, label: "ATS Sync",          sub: "Greenhouse",          icon: "📋", ck: "green"  },
    interview:    { cx: 660, cy: 240, w: 130, h: 46, label: "Interview",         sub: "Scheduled",           icon: "📅", ck: "green"  },
    rewardSig:    { cx: 660, cy: 375, w: 130, h: 46, label: "Reward Signal",     sub: "Recruiter Feedback",  icon: "🎯", ck: "orange" },
  };

  const theme: Record<string, { fill: string; stroke: string; sw: number }> = {
    blue:   { fill: "rgba(235,244,255,0.95)", stroke: "#2066C8", sw: 1.8 },
    purple: { fill: "rgba(243,241,255,0.95)", stroke: "#7B68EE", sw: 1.8 },
    green:  { fill: "rgba(232,246,236,0.95)", stroke: "#3E7A52", sw: 2.2 },
    amber:  { fill: "rgba(255,247,224,0.95)", stroke: "#D97706", sw: 2.2 },
    orange: { fill: "rgba(255,239,232,0.95)", stroke: "#EA580C", sw: 2.5 },
  };

  const e = (id: string, side: string): [number, number] => {
    const n = N[id];
    if (side === "r") return [n.cx + n.w / 2, n.cy];
    if (side === "l") return [n.cx - n.w / 2, n.cy];
    if (side === "b") return [n.cx, n.cy + n.h / 2];
    if (side === "t") return [n.cx, n.cy - n.h / 2];
    return [n.cx, n.cy];
  };
  const bez = (x1: number, y1: number, x2: number, y2: number) => { const mx = (x1 + x2) / 2; return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; };

  const solidPaths = [
    { d: bez(...e("candEnter","r"), ...e("microScreen","l")), c: "rgba(123,104,238,.32)", lbl: "evaluate", lx: 172, ly: 148, dot: "#7B68EE", delay: 0 },
    { d: bez(...e("candEnter","r"), ...e("smartRouter","l")), c: "rgba(123,104,238,.32)", lbl: "classify",  lx: 172, ly: 268, dot: "#7B68EE", delay: 0.1 },
    { d: bez(...e("microScreen","r"), ...e("recruiterNow","l")), c: "rgba(62,122,82,.38)", lbl: "≥85",     lx: 378, ly: 68,  dot: "#7AAE8A", delay: 0.2 },
    { d: bez(...e("microScreen","r"), ...e("quickScreen","l")), c: "rgba(62,122,82,.38)",  lbl: "50–84",   lx: 375, ly: 132, dot: "#7AAE8A", delay: 0.3 },
    { d: bez(...e("smartRouter","r"), ...e("novaAgent","l")),   c: "rgba(123,104,238,.32)",lbl: "automate", lx: 368, ly: 355, dot: "#7B68EE", delay: 0.4 },
    { d: bez(...e("redirectLane","r"), ...e("atsSync","l")),    c: "rgba(62,122,82,.32)",  lbl: "sync",    lx: 567, ly: 196, dot: "#7AAE8A", delay: 0.5 },
    { d: bez(...e("novaAgent","r"), ...e("interview","l")),     c: "rgba(62,122,82,.32)",  lbl: "schedule",lx: 562, ly: 322, dot: "#7AAE8A", delay: 0.55 },
    { d: `M${e("recruiterNow","r")[0]},${e("recruiterNow","r")[1]} C${e("recruiterNow","r")[0]+30},${e("recruiterNow","r")[1]} ${e("atsSync","r")[0]+30},${e("atsSync","r")[1]} ${e("atsSync","r")[0]},${e("atsSync","r")[1]}`, c: "rgba(122,174,138,.22)", delay: 0.6 },
    { d: `M${e("quickScreen","r")[0]},${e("quickScreen","r")[1]} C${e("quickScreen","r")[0]+28},${e("quickScreen","r")[1]} ${e("interview","r")[0]+28},${e("interview","r")[1]} ${e("interview","r")[0]},${e("interview","r")[1]}`, c: "rgba(122,174,138,.22)", delay: 0.65 },
  ];

  const orangePath = `M${e("microScreen","b")[0]},${e("microScreen","b")[1]} C${e("microScreen","b")[0]},${e("microScreen","b")[1]+65} ${e("redirectLane","l")[0]-40},${e("redirectLane","l")[1]} ${e("redirectLane","l")[0]},${e("redirectLane","l")[1]}`;
  const dashedPaths = [
    { d: `M${e("interview","b")[0]},${e("interview","b")[1]} C${e("interview","b")[0]},${e("interview","b")[1]+32} ${e("rewardSig","t")[0]+5},${e("rewardSig","t")[1]-28} ${e("rewardSig","t")[0]},${e("rewardSig","t")[1]}`, c: "rgba(123,104,238,.3)" },
    { d: `M${e("atsSync","b")[0]},${e("atsSync","b")[1]} C${e("atsSync","b")[0]},${e("atsSync","b")[1]+42} ${e("rewardSig","t")[0]+12},${e("rewardSig","t")[1]-28} ${e("rewardSig","t")[0]},${e("rewardSig","t")[1]}`, c: "rgba(123,104,238,.22)" },
  ];

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !ref.current || !tooltipRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const svgX = (e.clientX - svgRect.left) * (W / svgRect.width);
    const svgY = (e.clientY - svgRect.top)  * (H / svgRect.height);
    let found: typeof N[string] | null = null;
    let foundId = "";
    for (const [id, n] of Object.entries(N)) {
      if (svgX >= n.cx - n.w / 2 && svgX <= n.cx + n.w / 2 &&
          svgY >= n.cy - n.h / 2 && svgY <= n.cy + n.h / 2) {
        found = n; foundId = id; break;
      }
    }
    if (!found) return;
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    const containerRect = ref.current.getBoundingClientRect();
    const x = found.cx * (svgRect.width / W) + (svgRect.left - containerRect.left);
    const y = found.cy * (svgRect.height / H) + (svgRect.top - containerRect.top);
    const aboveNode = found.cy > 80;
    const tip = tooltipRef.current;
    tip.style.left = `${x}px`;
    tip.style.top = aboveNode ? `${y - 12}px` : `${y + 12}px`;
    tip.style.transform = aboveNode ? "translate(-50%, calc(-100% - 8px))" : "translate(-50%, 8px)";
    tip.style.opacity = "1";
    const titleEl = tip.querySelector<HTMLElement>("[data-tip-title]");
    const descEl  = tip.querySelector<HTMLElement>("[data-tip-desc]");
    if (titleEl) titleEl.textContent = `${found.icon} ${found.label}`;
    if (descEl)  descEl.textContent  = descriptions[foundId];
    if (tipArrowRef.current) {
      const a = tipArrowRef.current;
      if (aboveNode) {
        a.style.bottom = "-5px"; a.style.top = "";
        a.style.borderTop = "5px solid rgba(13,30,20,0.93)"; a.style.borderBottom = "";
      } else {
        a.style.top = "-5px"; a.style.bottom = "";
        a.style.borderBottom = "5px solid rgba(13,30,20,0.93)"; a.style.borderTop = "";
      }
    }
  };

  const handleSvgMouseLeave = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    }, 120);
  };

  const NodeG = ({ id }: { id: string }) => {
    const n = N[id]; const t = theme[n.ck];
    const isClickable = id === "rewardSig";
    const nodeIdx = Object.keys(N).indexOf(id);
    return (
      <motion.g initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: nodeIdx * 0.07, duration: 0.42 }}
        onClick={isClickable ? onRewardClick : undefined}
        style={{ cursor: isClickable ? "pointer" : "default" }}>
        {(n.ck === "green" || n.ck === "orange") && (
          <rect x={n.cx - n.w / 2 - 2} y={n.cy - n.h / 2 - 2} width={n.w + 4} height={n.h + 4} rx="14" fill="none" stroke={t.stroke} strokeWidth="1" opacity="0.2" />
        )}
        <rect x={n.cx - n.w / 2} y={n.cy - n.h / 2} width={n.w} height={n.h} rx="12" fill={t.fill} stroke={t.stroke} strokeWidth={t.sw} />
        <rect x={n.cx - n.w / 2 + 1} y={n.cy - n.h / 2 + 5} width="4" height={n.h - 10} rx="2" fill={t.stroke} opacity="0.65" />
        <text x={n.cx + 5} y={n.cy - 7} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fontWeight="700" fontFamily="'DM Sans',sans-serif"
          fill={n.ck === "green" ? "#1A5A2A" : n.ck === "orange" ? "#C24A10" : n.ck === "amber" ? "#92520A" : "#3D2ECC"}>{n.icon} {n.label}</text>
        <text x={n.cx + 5} y={n.cy + 10} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fontFamily="'DM Sans',sans-serif" fill="#6B7A6B">{n.sub}</text>
        {isClickable && (
          <motion.circle cx={n.cx + n.w / 2 - 10} cy={n.cy - n.h / 2 + 10} r="4.5" fill="#EA580C"
            animate={{ scale: [1, 1.6, 1], opacity: [0.85, 0.1, 0.85] }} transition={{ repeat: Infinity, duration: 1.7 }} />
        )}
      </motion.g>
    );
  };

  const legend = [
    { label: "High Priority (≥85)",   color: "#3E7A52", bg: "rgba(62,122,82,.1)" },
    { label: "Auto-Evaluate (50–84)", color: "#2066C8", bg: "rgba(32,102,200,.1)" },
    { label: "Low-Fit Triage (<50)",  color: "#D97706", bg: "rgba(217,119,6,.1)" },
    { label: "ATS Sync + Interview",  color: "#3E7A52", bg: "rgba(62,122,82,.07)" },
    { label: "Feedback loop",         color: "#EA580C", bg: "rgba(234,88,12,.1)", clickable: true },
  ];

  return (
    <div ref={ref} style={{ background: "rgba(255,255,255,0.55)", borderRadius: 22, border: `1px solid ${C.border}`, padding: "22px 12px 20px", boxShadow: C.shadow, position: "relative", overflow: "visible" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 22, zIndex: 0, opacity: 0.34, overflow: "hidden", backgroundImage: "linear-gradient(rgba(62,122,82,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(62,122,82,.08) 1px,transparent 1px)", backgroundSize: "26px 26px" }} />
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ position: "relative", zIndex: 2, display: "block", overflow: "visible" }} onMouseMove={handleSvgMouseMove} onMouseLeave={handleSvgMouseLeave}>
        <defs>
          <marker id="arr-rg" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto"><path d="M0,1 L5.5,3 L0,5 Z" fill="rgba(122,174,138,0.5)" /></marker>
          <marker id="arr-ro" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto"><path d="M0,1 L5.5,3 L0,5 Z" fill="rgba(217,119,6,0.7)" /></marker>
        </defs>
        {solidPaths.map((p, i) => (
          <g key={`rsp-${i}`}>
            <path d={p.d} fill="none" stroke={p.c} strokeWidth="1.5" markerEnd="url(#arr-rg)" />
            {p.lbl && <text x={p.lx} y={p.ly} textAnchor="middle" fontSize="8.5" fontFamily="'DM Sans',sans-serif" fill="rgba(123,104,238,.72)" fontWeight="600">{p.lbl}</text>}
          </g>
        ))}
        <path d={orangePath} fill="none" stroke="rgba(217,119,6,.65)" strokeWidth="1.6" strokeDasharray="5,3" markerEnd="url(#arr-ro)" />
        <text x={410} y={238} textAnchor="middle" fontSize="8.5" fontFamily="'DM Sans',sans-serif" fill="rgba(217,119,6,.82)" fontWeight="700">{"<50"}</text>
        {dashedPaths.map((p, i) => <path key={`rdsh-${i}`} d={p.d} fill="none" stroke={p.c} strokeWidth="1.3" strokeDasharray="4,3" />)}
        {inView && solidPaths.map((p, i) => (
          <motion.circle key={`rdd-${i}`} r="3" fill={p.dot || "#7AAE8A"}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.85, 0.85, 0], offsetDistance: ["0%", "0%", "50%", "100%", "100%"] } as never}
            style={{ offsetPath: `path("${p.d}")`, offsetRotate: "0deg" } as React.CSSProperties}
            transition={{ delay: p.delay + 0.5, duration: 2.0, repeat: Infinity, repeatDelay: 1.8, ease: "easeInOut" }}
          />
        ))}
        {Object.keys(N).map(id => <NodeG key={id} id={id} />)}
      </svg>
      <div style={{ position: "relative", zIndex: 3, marginTop: 14, display: "flex", flexWrap: "wrap", gap: 7 }}>
        {legend.map(c => (
          <span key={c.label} onClick={c.clickable ? onRewardClick : undefined}
            style={{ background: c.bg, border: `1px solid ${c.color}30`, borderRadius: 99, padding: "4px 12px", fontSize: 10.5, color: c.color, fontWeight: 500, cursor: c.clickable ? "pointer" : "default" }}>
            {c.label}{c.clickable ? " →" : ""}
          </span>
        ))}
      </div>

      {/* ── Node Tooltip (DOM-driven, zero React re-renders) ── */}
      <div
        ref={tooltipRef}
        style={{ position: "absolute", opacity: 0, transition: "opacity 0.18s ease", zIndex: 50, pointerEvents: "none", maxWidth: 215, left: 0, top: 0 }}
      >
        <div ref={tipArrowRef} style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", bottom: -5, borderTop: "5px solid rgba(13,30,20,0.93)" }} />
        <div style={{ background: "rgba(13,30,20,0.93)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: 10, padding: "10px 13px", boxShadow: "0 8px 28px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.06)" }}>
          <div data-tip-title style={{ fontSize: 11, fontWeight: 700, color: "#7FD4A0", marginBottom: 4, letterSpacing: "0.01em" }} />
          <div data-tip-desc  style={{ fontSize: 11.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.55 }} />
        </div>
      </div>
    </div>
  );
}

// ── Agent Config Modal ────────────────────────────────────────────────────────
function AgentConfigModal({ onClose }: { onClose: () => void }) {
  const metrics = [
    { label: "Fit Score Weight",    val: 82, delta: "+2.0%", up: true,  color: "#7B68EE" },
    { label: "Risk Detection",      val: 91, delta: "+3.0%", up: true,  color: "#3E7A52" },
    { label: "Routing Accuracy",    val: 76, delta: "-2.0%", up: false, color: "#7B68EE" },
    { label: "ATS Sync Success",    val: 94, delta: "+1.0%", up: true,  color: "#3E7A52" },
    { label: "Screen Speed",        val: 87, delta: "+1.0%", up: true,  color: "#3E7A52" },
    { label: "Rejection Precision", val: 73, delta: "-2.0%", up: false, color: "#7B68EE" },
  ];
  const stats = [
    { label: "Positive",     count: 4,     icon: "👍", color: "#3E7A52", bg: "#E6F5EA" },
    { label: "Negative",     count: 2,     icon: "👎", color: "#B25040", bg: "#FFE8E4" },
    { label: "Awaiting",     count: 2,     icon: "⚠️", color: "#6B7280", bg: "#F0F2F0" },
    { label: "Approval Rate",count: "67%", icon: "✅", color: "#7B68EE", bg: "#EDEAFF" },
  ];
  return (
    <AnimatePresence>
      <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.91, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} onClick={e => e.stopPropagation()}
          style={{ background: "#fff", borderRadius: 22, padding: "26px 26px 22px", maxWidth: 660, width: "100%", boxShadow: "0 24px 64px rgba(13,35,24,0.22)", maxHeight: "90vh", overflowY: "auto", fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: C.fg }}>Agent Config</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>Customize AI Agent Behavior</div>
            </div>
            <button style={{ background: C.fg, color: "#EDF3EE", border: "none", borderRadius: 99, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }} onClick={onClose}>Close ×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "13px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 19, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
                <div style={{ fontSize: 10.5, color: s.color, fontWeight: 500, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#F6FAF6", borderRadius: 15, padding: "16px 16px 14px", marginBottom: 16, border: "1px solid #DCE8DC" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.fg, marginBottom: 14 }}>⚙ Model Weight Dashboard</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {metrics.map((m, i) => (
                <div key={m.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 500 }}>{m.label}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: m.up ? "#3E7A52" : "#B25040" }}>{m.up ? "↑" : "↓"} {m.delta}</span>
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: C.fg, marginBottom: 5 }}>{m.val} <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 400 }}>/ 100</span></div>
                  <div style={{ height: 5, borderRadius: 99, background: "#D0E4D4", overflow: "hidden" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${m.val}%` }} transition={{ duration: 0.75, delay: i * 0.07 }}
                      style={{ height: "100%", borderRadius: 99, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#FFF7F0", border: "1px solid rgba(234,88,12,.2)", borderRadius: 11, padding: "13px 15px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#EA580C", marginBottom: 5 }}>💡 How Feedback Improves the Agent</div>
            <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.65 }}>Rate each agent action with thumbs-up/down to create reward signals. Positive rewards strengthen successful patterns; negative rewards penalize mistakes.</div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const { openSignIn } = useClerk();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const handleGetStarted = () => router.push("/get-started");

  const steps = [
    { n: "01", title: "Batch applications in parallel",        chip: "Within minutes",          desc: "Agent spawns parallel workers per role — no sequential queue, no tab overload." },
    { n: "02", title: "Field mapping + auto-generate answers", chip: "Per role",                desc: "Profile memory pre-fills every question; tailored cover letters and answers generated." },
    { n: "03", title: "Social evidence packet",                chip: "LinkedIn · GitHub · Web", desc: "Verified links, snapshot captures, and summarized public signal." },
    { n: "04", title: "Fit scoring + risk flags",              chip: "60–90 seconds",           desc: "LLM scoring against the JD, red-flag detection, and experience gap analysis." },
    { n: "05", title: "Safe-stop review + ATS handoff",        chip: "One click",               desc: "Human reviews before submission. Structured brief drops into your ATS." },
  ];


  const featureCards = [
    { title: "Candidate Agent", icon: "🤖", color: "#3E7A52", bullets: ["Batches 10+ applications simultaneously via parallel agents", "Field Mapper pre-fills every form from profile memory", "Generates tailored answers, cover letters & safe-stop review"], mock: ["Parallel batch: 10 roles", "Field mapper: on", "Safe-stop: enabled"] },
    { title: "Recruiter Agent", icon: "📋", color: "#4A7ACC", bullets: ["Scores candidate fit against JD in 60–90 seconds", "Runs automated social screening across platforms", "Flags experience gaps and inconsistencies"], mock: ["Fit score: 92%", "Risk flags: 0", "Evidence: verified"] },
    { title: "Evidence Packet", icon: "📦", color: "#B07030", bullets: ["Aggregates LinkedIn, GitHub, web presence in one view", "Screenshot snapshots + link verification", "ATS-ready structured brief for recruiter handoff"], mock: ["Links: 6 verified", "Snapshot: done", "Brief: ready"] },
  ];

  const manualBullets = ["10–20 min per application form", "5–8 browser tabs per candidate", "Inconsistent, memory-based notes", "Repetitive copy-paste every session", "Manual social checks take hours", "No parallelism — strictly sequential"];
  const aiBullets = ["1–5 min per role via parallel batch agents", "One unified workflow — field mapper handles fills", "Structured evidence packet, every candidate", "Profile memory across all roles + sessions", "Auto social screening in seconds", "Safe-stop review before every submission"];

  const candRows = [
    { title: "2–5× faster — batch applying in parallel", content: (<div><TimeBar label="Before" pct={82} rangeLabel="10–20 min" color="#B8D0BC" delay={0.2} /><TimeBar label="After" pct={18} rangeLabel="1–5 min" color="#7AAE8A" delay={0.42} /><div style={{ fontSize: 11, color: C.muted, marginTop: 7 }}>Parallel agent batch — no sequential queue</div></div>) },
    { title: "10+ applications simultaneously", content: <BatchViz /> },
    { title: "50–80% fewer copy/paste errors via field mapping", content: <ErrorRing pct={65} color="#7AAE8A" /> },
    { title: "Safe-stop review before every submit", content: (<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{["Profile memory", "Field mapper", "Human review gate", "Confirmation capture"].map(t => <span key={t} style={{ background: C.accentXs, border: `1px solid rgba(62,122,82,.22)`, borderRadius: 99, padding: "4px 11px", fontSize: 10.5, color: C.accent, fontWeight: 500 }}>{t}</span>)}</div>) },
  ];

  const recRows = [
    { title: "3–6× faster candidate review", content: (<div><TimeBar label="Before" pct={85} rangeLabel="8–15 min" color="#B8D0BC" delay={0.2} /><TimeBar label="After" pct={28} rangeLabel="2–5 min" color="#4A7ACC" delay={0.42} /><div style={{ fontSize: 11, color: C.muted, marginTop: 7 }}>8–15 min → 2–5 min per candidate</div></div>) },
    { title: "60–90 seconds to triage", content: <StopwatchTile /> },
    { title: "80% reduction in open-tab chaos", content: <EvidenceViz /> },
    { title: "Auto social screening + ATS adaptive", content: <ATSViz /> },
  ];


  return (
    <>
      <style>{globalStyle}</style>
      <div className="lp grain-wrap">

        {/* ── NAV ── */}
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, padding: "0 24px", backdropFilter: scrolled ? "blur(18px) saturate(1.5)" : "none", background: scrolled ? "rgba(237,243,238,0.84)" : "transparent", borderBottom: scrolled ? `1px solid rgba(62,122,82,0.12)` : "none", transition: "all 0.38s ease" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 62 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={LOGO_URL} alt="AI Hire AI" style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 10 }} />
              <span className="serif" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: C.fg }}>AI Hire AI</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <button className="btn-primary" style={{ padding: "7px 18px", fontSize: 12.5 }} onClick={handleGetStarted}>Get Started</button>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ position: "relative", textAlign: "center", padding: "148px 24px 90px", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 650, height: 650, background: "radial-gradient(ellipse, rgba(122,174,138,.18) 0%, rgba(122,174,138,.04) 58%, transparent 74%)", borderRadius: "50%", animation: "orbDrift 14s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 840, margin: "0 auto" }}>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.52 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(122,174,138,.13)", border: "1px solid rgba(62,122,82,.26)", borderRadius: 99, padding: "6px 17px", marginBottom: 32, fontSize: 12, color: C.accent, fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accentLt, display: "inline-block" }} />
                Built for the 2nd Earth of hiring
              </span>
            </motion.div>
            <motion.h1 className="serif" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.76, delay: 0.1 }}
              style={{ fontSize: "clamp(40px,6vw,72px)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 24, color: C.fg }}>
              Apply smarter.<br />Screen faster.<br />
              <em style={{ color: C.accent }}>Ship hires in days.</em>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.62, delay: 0.22 }}
              style={{ fontSize: "clamp(15px,2vw,18px)", color: C.muted, maxWidth: 580, margin: "0 auto 38px", lineHeight: 1.7 }}>
              Dual-sided multi-agent workflows for candidates and recruiters — autofill applications, generate answers & follow-ups, and produce ATS-ready social fit briefs.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.52, delay: 0.33 }}
              style={{ display: "flex", gap: 11, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
              <button className="btn-primary" style={{ padding: "14px 32px", fontSize: 14.5 }} onClick={handleGetStarted}>Get Started</button>
              <button className="btn-secondary" style={{ padding: "14px 32px", fontSize: 14.5 }}>Watch Demo</button>
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ fontSize: 11.5, color: "#8A9A8A", letterSpacing: "0.04em" }}>
              Powered by Amazon Nova / Bedrock + action agents.
            </motion.p>
          </div>
        </section>

        {/* ── DEMO VIDEO ── */}
        <section style={{ padding: "0 24px 88px" }}>
          <Reveal style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ background: "linear-gradient(160deg,#12281A 0%,#08160D 100%)", borderRadius: 22, aspectRatio: "16/9", position: "relative", border: "1px solid rgba(122,174,138,.16)", boxShadow: "0 20px 52px rgba(13,35,24,.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, opacity: 0.055, backgroundImage: "linear-gradient(rgba(122,174,138,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(122,174,138,.6) 1px,transparent 1px)", backgroundSize: "36px 36px" }} />
              <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                <div style={{ marginBottom: 13 }}><PlayIcon /></div>
                <div style={{ color: "#EDF3EE", fontSize: 15, fontWeight: 600 }}>Watch 90s demo</div>
                <div style={{ color: "#7AAE8A", fontSize: 12, marginTop: 5 }}>See AI Hire AI in action</div>
              </div>
              <div style={{ position: "absolute", top: 14, left: 18, fontSize: 10, color: "#7AAE8A", fontWeight: 700, letterSpacing: "0.08em" }}>LIVE DEMO</div>
              <div style={{ position: "absolute", top: 14, right: 18, display: "flex", gap: 5 }}>
                {["#C25050", "#C2A040", "#40C265"].map(c => <span key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.82, display: "inline-block" }} />)}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── INTEGRATION MARQUEE ── */}
        {(() => {
          const logos = [
            { src: "/logos/greenhouse.png",          name: "Greenhouse"      },
            { src: "/logos/github.png",               name: "GitHub"          },
            { src: "/logos/zoom.png",                 name: "Zoom"            },
            { src: "/logos/google-calendar-icon.png", name: "Google Calendar" },
            { src: "/logos/workday.png",              name: "Workday"         },
            { src: "/logos/gmail-clean.png",          name: "Gmail"           },
            { src: "/logos/ashby.png",                name: "Ashby"           },
            { src: "/logos/google-drive.png",         name: "Google Drive"    },
            { src: "/logos/vervoe.svg",               name: "Vervoe"          },
            { src: "/logos/chrome.png",               name: "Chrome"          },
            { src: "/logos/safari.png",               name: "Safari"          },
          ];
          // 4 copies so the track is always wider than any viewport — prevents the gap/respawn glitch
          const repeated = [...logos, ...logos, ...logos, ...logos];
          return (
            <section style={{ padding: "0 0 88px", overflow: "hidden" }}>
              <Reveal>
                <div style={{ textAlign: "center", marginBottom: 44 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ height: 1, width: 48, background: "linear-gradient(to right, transparent, rgba(62,122,82,0.45))" }} />
                    <span style={{ fontSize: 10.5, letterSpacing: "0.14em", fontWeight: 700, color: C.accent, textTransform: "uppercase" }}>Integrations</span>
                    <div style={{ height: 1, width: 48, background: "linear-gradient(to left, transparent, rgba(62,122,82,0.45))" }} />
                  </div>
                  <h3 className="serif" style={{ fontSize: "clamp(22px,2.8vw,34px)", fontWeight: 700, color: C.fg, letterSpacing: "-0.022em", lineHeight: 1.18, margin: 0 }}>
                    Works with the tools<br /><em style={{ color: C.accent }}>you already use.</em>
                  </h3>
                </div>
              </Reveal>
              <div style={{ overflow: "hidden", maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)" }}>
                <div className="marquee-track-left" style={{ alignItems: "center" }}>
                  {repeated.map((logo, i) => (
                    <div key={`m-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 44px", flexShrink: 0 }}>
                      <img src={logo.src} alt={logo.name} style={{ height: 38, width: "auto", maxWidth: 120, objectFit: "contain", opacity: 0.65, filter: "grayscale(20%)", pointerEvents: "none" }} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── CANDIDATE FLOW ── */}
        <section style={{ padding: "0 24px 96px" }}>
          <div style={{ maxWidth: 1320, margin: "0 auto" }}>
            <Reveal><div style={{ textAlign: "center", marginBottom: 52 }}><span style={{ fontSize: 12, letterSpacing: "0.11em", color: C.accent, fontWeight: 700 }}>HOW CANDIDATES APPLY (AGENTIC FLOW)</span></div></Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 64, alignItems: "center" }}>
              <Reveal>
                <div style={{ paddingTop: 6 }}>
                  <h2 className="serif" style={{ fontSize: "clamp(30px,3.8vw,50px)", fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.13, marginBottom: 22, color: C.fg }}>
                    Apply in parallel with<br /><em style={{ color: C.accent }}>agentic workflows.</em>
                  </h2>
                  <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.74, marginBottom: 32 }}>Your profile + resume + job description feed specialized agents that tailor your materials, answer questions, and prefill forms — then hand you a safe-stop review before submission.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {[{ icon: "⚡", text: "Batch 10+ applications in parallel — minutes, not hours" }, { icon: "🗂️", text: "Field Mapper fills every form from your profile memory" }, { icon: "🛡️", text: "Safe-stop review: you see it before the agent submits" }].map(o => (
                      <div key={o.text} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 22, lineHeight: 1.1 }}>{o.icon}</span>
                        <span style={{ fontSize: 17, color: C.fg, lineHeight: 1.58, fontWeight: 500 }}>{o.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.1}><AgentFlowchart /></Reveal>
            </div>
          </div>
        </section>

        {/* ── BENEFITS PANELS ── */}
        <section style={{ padding: "0 24px 96px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <Reveal>
              <div style={{ textAlign: "center", marginBottom: 52 }}>
                <h2 className="serif" style={{ fontSize: "clamp(29px,4.5vw,50px)", fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8, color: C.fg }}>Built for speed. Built to scale.</h2>
                <p style={{ fontSize: 15, color: C.muted, margin: 0 }}>Two sides of the same hire — both powered by AI.</p>
              </div>
            </Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,500px),1fr))", gap: 24, alignItems: "stretch" }}>

              {/* ── Candidates Panel ── */}
              <Reveal delay={0} style={{ height: "100%" }}>
                <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bgCard, borderRadius: 22, border: "1px solid rgba(62,122,82,0.18)", boxShadow: "0 0 0 1.5px rgba(122,174,138,.12), 0 8px 32px rgba(13,35,24,.07)", overflow: "hidden" }}>
                  <div style={{ position: "relative", padding: "28px 28px 20px", background: "linear-gradient(135deg, rgba(62,122,82,0.08) 0%, rgba(122,174,138,0.04) 100%)", borderBottom: "1px solid rgba(62,122,82,0.1)", flexShrink: 0 }}>
                    <img src="/logos/candidate.png" alt="Candidate" style={{ position: "absolute", right: 16, bottom: 0, height: 90, objectFit: "contain", opacity: 0.92, pointerEvents: "none" }} />
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(62,122,82,0.1)", border: "1px solid rgba(62,122,82,0.2)", borderRadius: 99, padding: "3px 10px", marginBottom: 12, fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: "0.08em" }}>FOR CANDIDATES</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#3E7A52", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
                      <div>
                        <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: C.fg, lineHeight: 1.2 }}>Apply Smarter</div>
                        <div style={{ fontSize: 11.5, color: C.muted }}>Candidate-side automation</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {candRows.map((row, ri) => (
                      <Reveal key={row.title} delay={ri * 0.06} style={{ flex: 1 }}>
                        <motion.div whileHover={{ y: -2 }} style={{ height: "100%", background: "#F2F8F3", border: "1px solid #DAF0DE", borderRadius: 13, padding: "15px 17px" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.fg, marginBottom: 10 }}>{row.title}</div>
                          {row.content}
                        </motion.div>
                      </Reveal>
                    ))}
                  </div>
                </div>
              </Reveal>

              {/* ── Recruiters Panel ── */}
              <Reveal delay={0.1} style={{ height: "100%" }}>
                <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bgCard, borderRadius: 22, border: "1px solid rgba(74,122,204,0.18)", boxShadow: "0 0 0 1.5px rgba(74,122,204,.1), 0 8px 32px rgba(13,35,24,.07)", overflow: "hidden" }}>
                  <div style={{ position: "relative", padding: "28px 28px 20px", background: "linear-gradient(135deg, rgba(74,122,204,0.08) 0%, rgba(74,122,204,0.03) 100%)", borderBottom: "1px solid rgba(74,122,204,0.1)", flexShrink: 0 }}>
                    <img src="/logos/recruiter.png" alt="Recruiter" style={{ position: "absolute", right: 16, bottom: 0, height: 90, objectFit: "contain", opacity: 0.92, pointerEvents: "none" }} />
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(74,122,204,0.1)", border: "1px solid rgba(74,122,204,0.22)", borderRadius: 99, padding: "3px 10px", marginBottom: 12, fontSize: 10, color: "#4A7ACC", fontWeight: 700, letterSpacing: "0.08em" }}>FOR RECRUITERS</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#4A7ACC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📋</div>
                      <div>
                        <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: C.fg, lineHeight: 1.2 }}>Screen Faster</div>
                        <div style={{ fontSize: 11.5, color: C.muted }}>Recruiter-side automation</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {recRows.map((row, ri) => (
                      <Reveal key={row.title} delay={ri * 0.06} style={{ flex: 1 }}>
                        <motion.div whileHover={{ y: -2 }} style={{ height: "100%", background: "#F2F8F3", border: "1px solid #DAF0DE", borderRadius: 13, padding: "15px 17px" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.fg, marginBottom: 10 }}>{row.title}</div>
                          {row.content}
                        </motion.div>
                      </Reveal>
                    ))}
                  </div>
                </div>
              </Reveal>

            </div>
          </div>
        </section>

        {/* ── RECRUITER FLOWCHART ── */}
        <section style={{ padding: "0 24px 100px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "420px 1fr", gap: 60, alignItems: "center" }}>
            {/* Left: heading + bullets */}
            <Reveal>
              <div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(123,104,238,.1)", border: "1px solid rgba(123,104,238,.25)", borderRadius: 99, padding: "5px 16px", marginBottom: 20, fontSize: 11, color: "#7B68EE", fontWeight: 600, letterSpacing: "0.06em" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7B68EE", display: "inline-block" }} />
                  RECRUITER WORKFLOW
                </span>
                <h2 className="serif" style={{ fontSize: "clamp(26px,3.2vw,42px)", fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.12, marginBottom: 14, color: C.fg }}>
                  Screen in minutes.<br /><em style={{ color: C.accent }}>Route in seconds.</em>
                </h2>
                <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 32 }}>AI micro-screening + smart routing + ATS automation. Recruiters get a clean lane decision and an ATS-ready packet — fast.</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { stat: "3–6×", text: "faster candidate review — compress 8–15 min → 2–5 min per candidate" },
                    { stat: "60–90s", text: "triage to a lane decision vs 5–10 min manual scanning" },
                    { stat: "30–60%", text: "fewer repetitive ATS actions" },
                    { stat: "50–80%", text: "less \"tab chaos\" — LinkedIn/GitHub/portfolio/web signals unified" },
                    { stat: "2–4×", text: "higher throughput at career fairs" },
                    { stat: "<10s", text: "recruiter feedback captured and used to improve routing over time" },
                  ].map(({ stat, text }) => (
                    <li key={stat} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 0", borderBottom: "1px solid rgba(62,122,82,0.1)" }}>
                      <span style={{ minWidth: 72, fontWeight: 800, fontSize: 16, color: C.accent, paddingTop: 1, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{stat}</span>
                      <span style={{ fontSize: 15, color: C.fg, lineHeight: 1.55, fontWeight: 500 }}>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            {/* Right: flowchart full size */}
            <Reveal delay={0.1}>
              <RecruiterFlowchart onRewardClick={() => setShowModal(true)} />
            </Reveal>
          </div>
        </section>

        {/* ── HOW WE WORK ── */}
        <section style={{ padding: "78px 24px 92px", background: "rgba(13,35,24,.03)", borderTop: "1px solid rgba(62,122,82,.1)", borderBottom: "1px solid rgba(62,122,82,.1)" }}>
          <div style={{ maxWidth: 1060, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,350px),1fr))", gap: 54 }}>
            <Reveal>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 10.5, letterSpacing: "0.11em", color: C.accent, fontWeight: 700, marginBottom: 16 }}>THE WORKFLOW</div>
                <h2 className="serif" style={{ fontSize: "clamp(27px,3.8vw,46px)", fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.13, marginBottom: 16, color: C.fg }}>Agentic speed,<br />evidence-based<br />decisions.</h2>
                <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.72 }}>Five orchestrated steps from open role to confident hire — with no manual overhead and a safe-stop gate before every submit.</p>
              </div>
            </Reveal>
            <div>
              {steps.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.07}>
                  <motion.div whileHover={{ x: 4 }} style={{ display: "flex", gap: 17, paddingTop: 22, paddingBottom: 22, borderBottom: i < steps.length - 1 ? "1px solid rgba(62,122,82,.11)" : "none" }}>
                    <span className="serif" style={{ fontSize: 25, fontWeight: 700, color: "#A8C8B0", lineHeight: 1, minWidth: 36 }}>{s.n}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>{s.title}</span>
                        <span style={{ background: "rgba(122,174,138,.13)", border: "1px solid rgba(62,122,82,.2)", borderRadius: 99, padding: "2px 8px", fontSize: 10, color: C.accent, fontWeight: 500, whiteSpace: "nowrap" }}>{s.chip}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.62 }}>{s.desc}</p>
                    </div>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── BUILT WITH ── */}
        <section style={{ padding: "58px 24px 52px" }}>
          <Reveal style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#8A9A8A", marginBottom: 8, fontWeight: 700, textTransform: "uppercase" }}>Built With</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0D2318", marginBottom: 44, letterSpacing: "-0.02em" }}>
              Powered by best-in-class infrastructure
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", rowGap: 36, columnGap: 24 }}>
              {[
                { name: "Next.js",     src: "/logos/nextjs.svg"     },
                { name: "React",       src: "/logos/react.png"       },
                { name: "TypeScript",  src: "/logos/typescript.png"  },
                { name: "tRPC",        src: "/logos/trpc.svg"        },
                { name: "Drizzle",     src: "/logos/drizzle.svg"     },
                { name: "Supabase",    src: "/logos/supabase.png"    },
                { name: "PostgreSQL",  src: "/logos/postgresql-new.png" },
                { name: "Redis",       src: "/logos/redis.svg"          },
                { name: "AWS Bedrock", src: "/logos/bedrock.png"        },
                { name: "Nova Act",    src: "/logos/nova-act.png"       },
                { name: "Figma",       src: "/logos/figma.png"          },
                { name: "GitHub",      src: "/logos/github.png"      },
              ].map(({ name, src }) => (
                <motion.div
                  key={name}
                  whileHover={{ y: -4, opacity: 1 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: 0.6, cursor: "default" }}
                >
                  <img src={src} alt={name} style={{ height: 40, maxWidth: 80, objectFit: "contain" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6B8070", letterSpacing: "0.02em" }}>{name}</span>
                </motion.div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── FEATURE CARDS ── */}
        <section style={{ padding: "38px 24px 92px" }}>
          <div style={{ maxWidth: 1090, margin: "0 auto" }}>
            <Reveal><div style={{ textAlign: "center", marginBottom: 46 }}><h2 className="serif" style={{ fontSize: "clamp(27px,4vw,46px)", fontWeight: 700, letterSpacing: "-0.025em", color: C.fg }}>Three agents. One unified platform.</h2></div></Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,305px),1fr))", gap: 17 }}>
              {featureCards.map((card, i) => (
                <Reveal key={card.title} delay={i * 0.09}>
                  <motion.div className="lift" whileHover={{ boxShadow: `0 20px 48px rgba(13,35,24,.12), 0 0 0 1px ${card.color}26` }}
                    style={{ background: C.bgCard, border: "1px solid #D0E4D4", borderRadius: 20, padding: 28, height: "100%" }}>
                    <div style={{ background: "#E8F4EA", borderRadius: 11, padding: 13, marginBottom: 20, border: "1px solid #CDE4D0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                        <span style={{ fontSize: 16 }}>{card.icon}</span>
                        <div style={{ height: 7, borderRadius: 99, background: card.color, width: "36%", opacity: 0.65 }} />
                      </div>
                      {card.mock.map((m, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: card.color, opacity: 0.5 }} />
                          <div style={{ height: 6, borderRadius: 99, background: "#BEDAC2", flex: 1 }} />
                          <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{m}</div>
                        </div>
                      ))}
                    </div>
                    <div className="serif" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: C.fg }}>{card.title}</div>
                    <div style={{ width: 26, height: 3, borderRadius: 99, background: card.color, marginBottom: 14 }} />
                    {card.bullets.map((b, j) => (
                      <div key={j} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                        <Chk color={card.color} /><span style={{ fontSize: 13, color: C.muted, lineHeight: 1.52 }}>{b}</span>
                      </div>
                    ))}
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── COMPARISON ── */}
        <section style={{ padding: "38px 24px 92px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <Reveal><div style={{ textAlign: "center", marginBottom: 42 }}><h2 className="serif" style={{ fontSize: "clamp(27px,4vw,46px)", fontWeight: 700, letterSpacing: "-0.025em", color: C.fg }}>The old way vs. the agentic way.</h2></div></Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,400px),1fr))", gap: 16 }}>
              <Reveal>
                <div style={{ background: "linear-gradient(160deg,#1E1410 0%,#120C08 100%)", borderRadius: 20, padding: "32px 32px 36px", border: "1px solid rgba(180,80,50,.13)" }}>
                  <div style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "#C07050", marginBottom: 13, fontWeight: 700 }}>MANUAL HIRING</div>
                  <h3 className="serif" style={{ fontSize: 22, color: "#F0E8E0", fontWeight: 600, marginBottom: 22, opacity: 0.68 }}>Slow, scattered, inconsistent.</h3>
                  {manualBullets.map((b, i) => <div key={i} style={{ display: "flex", gap: 10, marginBottom: 11, alignItems: "flex-start" }}><Xmark /><span style={{ fontSize: 13, color: "#9A8878", lineHeight: 1.52 }}>{b}</span></div>)}
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div style={{ background: "linear-gradient(160deg,#0D2318 0%,#081810 100%)", borderRadius: 20, padding: "32px 32px 36px", border: "1px solid rgba(122,174,138,.22)", boxShadow: "0 0 36px rgba(62,122,82,.07)" }}>
                  <div style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "#7AAE8A", marginBottom: 13, fontWeight: 700 }}>AIHIREAI</div>
                  <h3 className="serif" style={{ fontSize: 22, color: "#EDF3EE", fontWeight: 600, marginBottom: 22 }}>Fast, unified, evidence-based.</h3>
                  {aiBullets.map((b, i) => <div key={i} style={{ display: "flex", gap: 10, marginBottom: 11, alignItems: "flex-start" }}><Chk color="#7AAE8A" /><span style={{ fontSize: 13, color: "#9EC8A8", lineHeight: 1.52 }}>{b}</span></div>)}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{ padding: "56px 24px 92px", textAlign: "center" }}>
          <Reveal style={{ maxWidth: 620, margin: "0 auto" }}>
            <div style={{ background: "linear-gradient(160deg, rgba(122,174,138,.1), rgba(62,122,82,.03))", border: "1px solid rgba(62,122,82,.17)", borderRadius: 26, padding: "58px 36px" }}>
              <h2 className="serif" style={{ fontSize: "clamp(29px,5vw,52px)", fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16, lineHeight: 1.11, color: C.fg }}>Ready to see AI Hire AI?</h2>
              <p style={{ fontSize: 15, color: C.muted, marginBottom: 30, lineHeight: 1.68 }}>Start automating your candidate pipeline today.</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
                <button className="btn-primary" style={{ padding: "14px 32px", fontSize: 14.5 }} onClick={handleGetStarted}>Get Started</button>
                <button className="btn-secondary" style={{ padding: "14px 32px", fontSize: 14.5 }}>Watch Demo</button>
              </div>
              <p style={{ fontSize: 11, color: "#8A9A8A" }}>Human review before submit.</p>
            </div>
          </Reveal>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: "1px solid rgba(62,122,82,.11)", padding: "30px 24px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={LOGO_URL} alt="AI Hire AI" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 7 }} />
              <span className="serif" style={{ fontSize: 16, fontWeight: 700, color: C.fg }}>AI Hire AI</span>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {["About", "Docs", "Contact"].map(l => (
                <a key={l} href="#" style={{ fontSize: 12.5, color: C.muted, textDecoration: "none", fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = C.fg}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = C.muted}>{l}</a>
              ))}
            </div>
            <span style={{ fontSize: 11, color: "#8A9A8A" }}>© AI Hire AI — built for the future of hiring.</span>
          </div>
        </footer>
      </div>

      {showModal && <AgentConfigModal onClose={() => setShowModal(false)} />}
    </>
  );
}
