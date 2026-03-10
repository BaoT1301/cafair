import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex h-screen w-full bg-white p-2.5 gap-4 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto rounded-2xl min-w-0">
        {children}
      </main>
    </div>
  );
}
