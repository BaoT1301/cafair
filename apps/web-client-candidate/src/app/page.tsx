"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Navbar } from "@/components/navbar";
import { Layers, Palette, Database, Code2 } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background overflow-hidden">
      <Navbar />

      <main className="relative flex flex-1 flex-col items-center justify-center z-10">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          {/* Hero */}
          <motion.div
            className="relative"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <div className="absolute -inset-6 rounded-full bg-primary/10 blur-3xl animate-pulse" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
              <Layers className="h-10 w-10 text-primary-foreground" />
            </div>
          </motion.div>

          <div className="flex flex-col items-center gap-4 text-center">
            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                CaFair
              </span>
            </motion.h1>
            <motion.p
              className="max-w-2xl text-lg text-muted-foreground sm:text-xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              A full-stack starter template with theming, auth, tRPC, Hono,
              Drizzle, and an LLM prompt service — ready to build on.
            </motion.p>
          </div>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                  Get Started
                </Button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="gap-2 shadow-lg shadow-primary/20"
                  >
                    Dashboard
                  </Button>
                </Link>
                <UserButton />
              </div>
            </SignedIn>
          </motion.div>

          {/* Feature cards */}
          <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
            {[
              {
                icon: Palette,
                title: "Theme Engine",
                desc: "20+ presets, live editor, Zustand store, View Transitions API. Full theming out of the box.",
              },
              {
                icon: Code2,
                title: "tRPC + Hono APIs",
                desc: "Type-safe tRPC for web clients and Hono REST endpoints for mobile — sharing one DB layer.",
              },
              {
                icon: Database,
                title: "Drizzle + Supabase",
                desc: "Drizzle ORM with Supabase PostgreSQL, Clerk-to-RLS auth bridge, and migration tooling.",
              },
              {
                icon: Layers,
                title: "LLM Prompt Service",
                desc: "Express microservice with Gemini AI, Redis caching, and a reusable prompt template registry.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                whileHover={{ y: -2 }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-card-foreground">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
