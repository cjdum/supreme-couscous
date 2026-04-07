/**
 * Mobile haptic feedback wrapper. No-op on desktop / browsers without vibration.
 * Used for: mod added, upvote, level up, primary set, etc.
 */

type HapticIntensity = "light" | "medium" | "heavy" | "success" | "selection";

const PATTERNS: Record<HapticIntensity, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 30, 10],
  selection: 5,
};

export function haptic(intensity: HapticIntensity = "light") {
  if (typeof window === "undefined") return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[intensity]);
  } catch {
    // ignore
  }
}
