/**
 * Feature 16 — Balatro-style awards.
 *
 * Awards are the *rare, celebratory* tier above badges. Where badges are
 * progress markers ("first mod", "10 mods"), awards are the moments worth
 * a cinematic reveal — a card flip with rarity glow, a haptic punch, the
 * works. Each has a rarity tier that drives the visual treatment.
 */

export type AwardRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface AwardDef {
  id: string;
  name: string;
  description: string;
  flavor: string; // 1-line poetic / hype line shown on the reveal card
  rarity: AwardRarity;
  icon: string; // matches BADGE_ICON_PATHS keys
}

export interface AwardCheckInput {
  carCount: number;
  modCount: number;
  installedModCount: number;
  totalInvested: number;
  topModCost: number; // most expensive single installed mod
  buildScore: number;
  hasRender: boolean;
  renderCount: number;
  publicCarCount: number;
  forumPostCount: number;
  carPhotoCount: number;
  uniqueCategoryCount: number;
  hpGain: number; // horsepower above stock baseline
  isNightOwl: boolean; // logged a mod between 12am-5am
}

interface AwardRule extends AwardDef {
  check: (i: AwardCheckInput) => boolean;
}

export const AWARDS: AwardRule[] = [
  // ── COMMON ─────────────────────────────────────────────────────────
  {
    id: "ignition",
    name: "Ignition",
    description: "Logged your first installed mod",
    flavor: "Every build starts with a single bolt.",
    rarity: "common",
    icon: "wrench",
    check: (i) => i.installedModCount >= 1,
  },
  {
    id: "garage_open",
    name: "Garage Open",
    description: "Added your first car",
    flavor: "The doors are up. Let's get to work.",
    rarity: "common",
    icon: "car",
    check: (i) => i.carCount >= 1,
  },

  // ── UNCOMMON ───────────────────────────────────────────────────────
  {
    id: "double_digits",
    name: "Double Digits",
    description: "Reached 10 installed mods",
    flavor: "Ten down. The rabbit hole is real.",
    rarity: "uncommon",
    icon: "wrench",
    check: (i) => i.installedModCount >= 10,
  },
  {
    id: "show_off",
    name: "Show Off",
    description: "Made a build public",
    flavor: "Time to let people see what you've been up to.",
    rarity: "uncommon",
    icon: "eye",
    check: (i) => i.publicCarCount >= 1,
  },
  {
    id: "first_render",
    name: "Crystal Ball",
    description: "Generated your first AI render",
    flavor: "A glimpse of the future, rendered in pixels.",
    rarity: "uncommon",
    icon: "camera",
    check: (i) => i.hasRender || i.renderCount >= 1,
  },

  // ── RARE ───────────────────────────────────────────────────────────
  {
    id: "five_grand",
    name: "Five Grand Deep",
    description: "Invested $5,000 across your build",
    flavor: "Money talks. Yours is yelling.",
    rarity: "rare",
    icon: "trending",
    check: (i) => i.totalInvested >= 5000,
  },
  {
    id: "all_rounder",
    name: "All-Rounder",
    description: "Mods across 5+ different categories",
    flavor: "Power, handling, looks — you don't pick favorites.",
    rarity: "rare",
    icon: "star",
    check: (i) => i.uniqueCategoryCount >= 5,
  },
  {
    id: "render_collector",
    name: "Render Collector",
    description: "Generated 10+ AI renders",
    flavor: "Some people sketch. You let the model dream.",
    rarity: "rare",
    icon: "camera",
    check: (i) => i.renderCount >= 10,
  },

  // ── EPIC ───────────────────────────────────────────────────────────
  {
    id: "horsepower_heretic",
    name: "Horsepower Heretic",
    description: "Added 100+ wheel horsepower over stock",
    flavor: "Stock was a suggestion. You ignored it.",
    rarity: "epic",
    icon: "zap",
    check: (i) => i.hpGain >= 100,
  },
  {
    id: "ten_grand_club",
    name: "Ten Grand Club",
    description: "Crossed $10,000 invested",
    flavor: "Welcome to the part where therapy is cheaper.",
    rarity: "epic",
    icon: "dollar",
    check: (i) => i.totalInvested >= 10000,
  },
  {
    id: "single_part_baller",
    name: "One Big Swing",
    description: "Logged a single mod over $3,000",
    flavor: "Why save up for ten parts when one will do?",
    rarity: "epic",
    icon: "award",
    check: (i) => i.topModCost >= 3000,
  },

  // ── LEGENDARY ──────────────────────────────────────────────────────
  {
    id: "vault_legend",
    name: "Vault Legend",
    description: "Hit a 500+ Vault build score",
    flavor: "The leaderboard whispers your name.",
    rarity: "legendary",
    icon: "award",
    check: (i) => i.buildScore >= 500,
  },
  {
    id: "fifty_deep",
    name: "Fifty Deep",
    description: "50+ installed mods on a single build",
    flavor: "At this point, the car is more you than factory.",
    rarity: "legendary",
    icon: "wrench",
    check: (i) => i.installedModCount >= 50,
  },
  {
    id: "night_shift",
    name: "Night Shift",
    description: "Logged a mod between midnight and 5am",
    flavor: "The garage light is the only one still on.",
    rarity: "legendary",
    icon: "flame",
    check: (i) => i.isNightOwl,
  },
];

export const AWARDS_BY_ID: Record<string, AwardDef> = Object.fromEntries(
  AWARDS.map((a) => [a.id, a])
);

/**
 * Run all award checks against the current input. Returns the IDs of every
 * award the user currently qualifies for. Pair with the `user_awards` table
 * to figure out which are *newly* unlocked.
 */
export function evaluateAwards(input: AwardCheckInput): string[] {
  return AWARDS.filter((a) => a.check(input)).map((a) => a.id);
}

export const RARITY_STYLES: Record<
  AwardRarity,
  { label: string; color: string; glow: string; border: string; bg: string }
> = {
  common: {
    label: "Common",
    color: "#cbd5e1",
    glow: "0 0 0 1px rgba(255,255,255,0.08), 0 0 24px rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.10)",
    bg: "rgba(255,255,255,0.04)",
  },
  uncommon: {
    label: "Uncommon",
    color: "#34d399",
    glow: "0 0 0 1px rgba(52,211,153,0.32), 0 0 32px rgba(52,211,153,0.22)",
    border: "rgba(52,211,153,0.32)",
    bg: "rgba(52,211,153,0.06)",
  },
  rare: {
    label: "Rare",
    color: "#60a5fa",
    glow: "0 0 0 1px rgba(96,165,250,0.40), 0 0 36px rgba(96,165,250,0.30)",
    border: "rgba(96,165,250,0.40)",
    bg: "rgba(96,165,250,0.07)",
  },
  epic: {
    label: "Epic",
    color: "#c084fc",
    glow: "0 0 0 1px rgba(192,132,252,0.45), 0 0 44px rgba(192,132,252,0.36)",
    border: "rgba(192,132,252,0.45)",
    bg: "rgba(192,132,252,0.08)",
  },
  legendary: {
    label: "Legendary",
    color: "#fbbf24",
    glow: "0 0 0 1px rgba(251,191,36,0.55), 0 0 60px rgba(251,191,36,0.45)",
    border: "rgba(251,191,36,0.55)",
    bg: "rgba(251,191,36,0.10)",
  },
};
