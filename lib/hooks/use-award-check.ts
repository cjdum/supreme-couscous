"use client";

import { useCallback, useState } from "react";

/**
 * Lightweight client hook that fires `/api/awards/check` and exposes any
 * newly-unlocked award IDs so the caller can render <AwardReveal />.
 */
export function useAwardCheck() {
  const [unlocked, setUnlocked] = useState<string[]>([]);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/awards/check", { method: "POST" });
      if (!res.ok) return;
      const json = (await res.json()) as { unlocked?: string[] };
      if (json.unlocked && json.unlocked.length > 0) {
        setUnlocked(json.unlocked);
      }
    } catch {
      // Award unlock is a nice-to-have; never crash a flow on failure.
    }
  }, []);

  const dismiss = useCallback(() => setUnlocked([]), []);

  return { unlocked, check, dismiss };
}
