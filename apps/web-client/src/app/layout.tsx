import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/trpc/client";
import { ThemeProvider } from "@/services/theme";
import { ThemeLoader } from "@/services/theme";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AlHire",
  description: "AI-powered hiring copilot for recruiters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`antialiased ${plusJakartaSans.variable} font-[family-name:var(--font-plus-jakarta)]`}>
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
