import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/trpc/client";
import { ThemeProvider } from "@/services/theme";
import { ThemeLoader } from "@/services/theme";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "CaFair",
  description:
    "A full-stack starter template with theming, auth, tRPC, Hono, Drizzle, and LLM prompt service.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="antialiased">
          <Suspense>
            <NuqsAdapter>
              <TRPCReactProvider>
                <ThemeProvider>
                  <ThemeLoader>{children}</ThemeLoader>
                </ThemeProvider>
              </TRPCReactProvider>
            </NuqsAdapter>
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}
