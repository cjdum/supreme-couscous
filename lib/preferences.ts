/**
 * Client-side user preferences stored in localStorage.
 * Schema-versioned so we can migrate cleanly later.
 */

export type DistanceUnit = "miles" | "km";
export type Currency = "USD" | "EUR" | "GBP";
export type Theme = "dark" | "light";
export type SidebarSide = "left" | "right";

export interface Preferences {
  version: 1;
  distanceUnit: DistanceUnit;
  currency: Currency;
  theme: Theme;
  emailNotifications: boolean;
  sidebarSide: SidebarSide;
}

export const DEFAULT_PREFS: Preferences = {
  version: 1,
  distanceUnit: "miles",
  currency: "USD",
  theme: "dark",
  emailNotifications: true,
  sidebarSide: "left",
};

const KEY = "modvault.prefs.v1";

export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1) {
      return { ...DEFAULT_PREFS, ...parsed };
    }
    return DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: Partial<Preferences>): Preferences {
  const current = loadPreferences();
  const next: Preferences = { ...current, ...prefs, version: 1 };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      // Apply theme immediately
      applyTheme(next.theme);
    } catch {
      // ignore
    }
  }
  return next;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};
