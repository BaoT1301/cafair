"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Wrapper component that shows a loading spinner until the theme is mounted.
 * Prevents flash of unstyled content (FOUC).
 */
export function ThemeLoader({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
