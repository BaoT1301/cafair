import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CandidateSidebar } from "@/components/candidate/CandidateSidebar";
import { PageTransition } from "@/components/PageTransition";

/**
 * Candidate shell.
 *
 * Structurally identical to `(dashboard)/layout.tsx` — the same floating-panel
 * shell (white page, 10px outer padding, rounded sidebar and content cards) so
 * both halves of the product feel like one app.
 */
export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex h-screen w-full bg-white p-2.5 gap-4 overflow-hidden">
      <CandidateSidebar />
      <main className="flex-1 overflow-y-auto rounded-2xl min-w-0">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
