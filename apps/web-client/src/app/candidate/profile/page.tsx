"use client";

/**
 * My Profile — identity plus the resume submission that drives scoring.
 *
 * The resume box posts to the same `/api/score` engine the recruiter side
 * uses, so what the candidate sees here is the assessment recruiters act on,
 * not a separate softened score.
 */

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, FileText, Loader2, CheckCircle2, Upload } from "lucide-react";
import {
  extractResumeText,
  ResumeExtractionError,
  ACCEPTED_RESUME_TYPES,
} from "@/lib/extract-resume-text";
import {
  PageShell,
  Card,
  CardTitle,
  CardSub,
  PrimaryButton,
  GhostButton,
  Toast,
  Tag,
  Badge,
  fadeUp,
} from "@/components/candidate/ui";

const inputCls =
  "w-full rounded-[8px] border border-[#e2e8e5] bg-white px-3 py-2.5 text-[14px] text-[#111827] tracking-[-0.015em] outline-none transition-colors placeholder:text-[#9ca3af] focus:border-[#1f6b43]";

const labelCls =
  "text-[13px] font-semibold text-[#111827] tracking-[-0.076px] mb-1.5 block";

export default function CandidateProfilePage() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: profile } = useQuery(trpc.candidate.getMyProfile.queryOptions());
  const { data: evidence } = useQuery(trpc.candidate.getMyEvidence.queryOptions());
  const { data: matches } = useQuery(trpc.candidate.getMyMatches.queryOptions());

  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [role, setRole] = useState("");
  const [resume, setResume] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setExtracting(true);
    setFileName(null);
    try {
      const text = await extractResumeText(file);
      setResume(text);
      setFileName(file.name);
      setToast(`Read ${text.length.toLocaleString()} characters from ${file.name}`);
    } catch (err) {
      setToast(
        err instanceof ResumeExtractionError
          ? err.message
          : "Couldn't read that file. Try pasting the text instead.",
      );
    } finally {
      setExtracting(false);
      // Reset so picking the same file twice still fires onChange.
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  // Seed the form once the profile arrives. Guarded on `profile.id` so a
  // background refetch can't clobber what the user is mid-way through typing.
  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setSchool(profile.school ?? "");
    setRole(profile.role ?? "");
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: trpc.candidate.getMyProfile.queryOptions().queryKey });
    qc.invalidateQueries({ queryKey: trpc.candidate.getMyEvidence.queryOptions().queryKey });
    qc.invalidateQueries({ queryKey: trpc.candidate.getMyMatches.queryOptions().queryKey });
  };

  const saveProfile = useMutation(
    trpc.candidate.updateMyProfile.mutationOptions({
      onSuccess: () => {
        invalidate();
        setToast("Profile saved");
      },
    }),
  );

  const submitResume = useMutation(
    trpc.candidate.submitResume.mutationOptions({
      onSuccess: (res) => {
        invalidate();
        setResume("");
        setToast(
          res.scored
            ? "Resume scored — see your feedback"
            : "Resume saved. Scoring is unavailable right now, we'll retry.",
        );
      },
      onError: (e) => setToast(e.message),
    }),
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const tooShort = resume.trim().length > 0 && resume.trim().length < 80;

  return (
    <PageShell
      title="My Profile"
      subtitle="This is what recruiters see, and what your assessment is built from."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Details ─────────────────────────────────────────── */}
        <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
          <Card className="h-full">
            <CardTitle>Details</CardTitle>
            <CardSub>Your email comes from your sign-in and can&apos;t be changed here.</CardSub>

            <div className="flex flex-col gap-4 mt-2">
              <div>
                <label className={labelCls} htmlFor="name">Full name</label>
                <input
                  id="name"
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="school">School</label>
                <input
                  id="school"
                  className={inputCls}
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="e.g. George Mason University"
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="role">Target role</label>
                <input
                  id="role"
                  className={inputCls}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Software Engineer Intern"
                />
              </div>

              <div>
                <label className={labelCls}>Email</label>
                <div className="w-full rounded-[8px] bg-[#f7f7f7] px-3 py-2.5 text-[14px] text-[#6b7280]">
                  {profile?.email ?? "—"}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-1">
                <PrimaryButton
                  onClick={() => saveProfile.mutate({ name, school, role })}
                  disabled={saveProfile.isPending || !name.trim()}
                >
                  {saveProfile.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save changes
                </PrimaryButton>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── Resume ──────────────────────────────────────────── */}
        <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
          <Card className="h-full">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Resume</CardTitle>
                <CardSub>Paste the text. We score it immediately.</CardSub>
              </div>
              {profile?.scored && <Badge tone="brand">Scored</Badge>}
            </div>

            <div className="mt-1">
              <label className={labelCls} htmlFor="roleTarget">Score against</label>
              <select
                id="roleTarget"
                className={inputCls}
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">General software internship</option>
                {matches?.map((m) => (
                  <option key={m.role.id} value={m.role.id}>
                    {m.role.title}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Upload dropzone ── */}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_RESUME_TYPES}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div
              onClick={() => !extracting && fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed px-4 py-6 transition-colors ${
                extracting
                  ? "cursor-wait border-[#e2e8e5] bg-[#f7f7f7]"
                  : dragging
                    ? "cursor-copy border-[#1f6b43] bg-[#e8f5ee]"
                    : "cursor-pointer border-[#e2e8e5] hover:border-[#1f6b43] hover:bg-[#e8f5ee]/40"
              }`}
            >
              {extracting ? (
                <>
                  <Loader2 className="w-5 h-5 text-[#1f6b43] animate-spin" />
                  <span className="text-[13px] font-medium text-[#4b5563]">
                    Reading your file…
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-[#1f6b43]" />
                  <span className="text-[13px] font-semibold text-[#111827]">
                    {fileName ?? "Upload your resume"}
                  </span>
                  <span className="text-[12px] text-[#9ca3af] text-center">
                    Drop a PDF or .txt here, or click to browse — we read it in your
                    browser, the file never leaves your device
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#e2e8e5]" />
              <span className="text-[11px] font-medium text-[#9ca3af] uppercase tracking-wider">
                or paste
              </span>
              <div className="h-px flex-1 bg-[#e2e8e5]" />
            </div>

            <textarea
              className={`${inputCls} min-h-[190px] resize-y font-normal leading-5`}
              value={resume}
              onChange={(e) => { setResume(e.target.value); setFileName(null); }}
              placeholder="Paste your resume here — experience, projects, skills, coursework…"
            />

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span
                className={`text-[12px] ${tooShort ? "text-[#991b1b]" : "text-[#9ca3af]"}`}
              >
                {tooShort
                  ? `${80 - resume.trim().length} more characters needed`
                  : `${resume.trim().length} characters`}
              </span>
              <PrimaryButton
                onClick={() =>
                  submitResume.mutate({
                    resumeText: resume.trim(),
                    roleId: roleId || undefined,
                  })
                }
                disabled={submitResume.isPending || resume.trim().length < 80}
              >
                {submitResume.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {submitResume.isPending ? "Scoring…" : "Submit & score"}
              </PrimaryButton>
            </div>

            {/* Evidence on file */}
            <div className="border-t border-[#e2e8e5] pt-4 mt-1 flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#111827]">On file</span>
              {evidence && evidence.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {evidence.slice(0, 5).map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5">
                      <FileText className="w-3.5 h-3.5 text-[#6b7280] shrink-0" />
                      <Tag>{e.type}</Tag>
                      <span className="text-[12px] text-[#9ca3af] ml-auto">
                        {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[13px] text-[#9ca3af]">
                  Nothing submitted yet.
                </span>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ── Success banner after scoring ──────────────────────── */}
      <AnimatePresence>
        {submitResume.data?.scored && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="flex-row items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-[#e8f5ee] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#1f6b43]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-semibold text-[#111827]">
                  Scored {submitResume.data.profile.fitScore}/100
                </span>
                <span className="text-[13px] text-[#6b7280]">
                  Head to AI Feedback for the full reasoning.
                </span>
              </div>
              <a href="/candidate/feedback" className="ml-auto shrink-0">
                <GhostButton>View feedback</GhostButton>
              </a>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </PageShell>
  );
}
