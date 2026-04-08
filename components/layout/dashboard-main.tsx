"use client";

import { useEffect, useState } from "react";
import { loadPreferences } from "@/lib/preferences";

/**
 * Client wrapper for the dashboard <main> element.
 * Reads the sidebarSide preference from localStorage and applies the correct
 * left or right padding so content doesn't sit under the fixed sidebar.
 */
export function DashboardMain({ children }: { children: React.ReactNode }) {
  const [side, setSide] = useState<"left" | "right">("left");

  useEffect(() => {
    const prefs = loadPreferences();
    setSide(prefs.sidebarSide ?? "left");

    // Re-read when the preference changes (e.g. toggled in settings)
    function onStorage(e: StorageEvent) {
      if (e.key?.includes("modvault")) {
        const p = loadPreferences();
        setSide(p.sidebarSide ?? "left");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <main
      className={`pt-16 lg:pt-0 animate-fade pb-[max(88px,calc(env(safe-area-inset-bottom)+76px))] lg:pb-8 ${
        side === "right" ? "lg:pr-14" : "lg:pl-14"
      }`}
    >
      {children}
    </main>
  );
}
