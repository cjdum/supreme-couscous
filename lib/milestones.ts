/**
 * Build milestones — auto-computed achievements based on user's garage state.
 *
 * All milestones are derived from existing data (cars, mods, cards). No new
 * DB columns needed. Recomputed on every page view — cheap and deterministic.
 */

import type { ModCategory } from "@/lib/supabase/types";

export interface MilestoneInput {
  cars: Array<{
    id: string;
    horsepower: number | null;
    zero_to_sixty: number | null;
    cover_image_url: string | null;
    vin_verified: boolean;
    is_public: boolean;
  }>;
  mods: Array<{
    id: string;
    car_id: string;
    category: ModCategory;
    cost: number | null;
    status: string;
    install_date: string | null;
    is_diy: boolean;
  }>;
  /** Minted pixel cards count (optional) */
  cardCount?: number;
  /** Card count per car, for first-mint milestone. */
  cardsByCarId?: Record<string, number>;
  /** Forum post count — optional community milestones. */
  forumPostCount?: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  /** Lucide icon name — caller resolves it. */
  icon: string;
  /** Rarity tier: bronze / silver / gold / platinum */
  tier: "bronze" | "silver" | "gold" | "platinum";
  /** Unlocked? */
  earned: boolean;
  /** Optional numeric progress (0-1) for not-yet-earned milestones. */
  progress?: number;
  /** Optional category filter for display grouping. */
  group: "build" | "spend" | "cards" | "community" | "diversity";
}

/** Order roughly from easiest → hardest so the list reads nicely. */
export function computeMilestones(input: MilestoneInput): Milestone[] {
  const { cars, mods, cardCount = 0, forumPostCount = 0 } = input;
  const installed = mods.filter((m) => m.status === "installed");
  const totalSpent = installed.reduce((s, m) => s + (m.cost ?? 0), 0);
  const uniqueCategories = new Set(installed.map((m) => m.category)).size;
  const diyCount = installed.filter((m) => m.is_diy).length;
  const carsWithPhoto = cars.filter((c) => c.cover_image_url).length;
  const verifiedCars = cars.filter((c) => c.vin_verified).length;
  const publicCars = cars.filter((c) => c.is_public).length;
  const maxHP = cars.reduce((max, c) => Math.max(max, c.horsepower ?? 0), 0);
  const bestZeroToSixty = cars.reduce(
    (best, c) => (c.zero_to_sixty != null && c.zero_to_sixty > 0 && (best == null || c.zero_to_sixty < best) ? c.zero_to_sixty : best),
    null as number | null,
  );

  const list: Milestone[] = [];

  const push = (
    id: string,
    title: string,
    description: string,
    icon: string,
    tier: Milestone["tier"],
    group: Milestone["group"],
    earned: boolean,
    progress?: number,
  ) => list.push({ id, title, description, icon, tier, earned, progress, group });

  // ── GARAGE / BUILD MILESTONES ───────────────────────────────────────────
  push(
    "first-car",
    "Welcome to the garage",
    "Add your first car",
    "Car",
    "bronze",
    "build",
    cars.length >= 1,
    Math.min(1, cars.length),
  );
  push(
    "fleet-of-two",
    "Fleet of two",
    "Garage holds 2 cars",
    "Car",
    "silver",
    "build",
    cars.length >= 2,
    Math.min(1, cars.length / 2),
  );
  push(
    "full-garage",
    "Full garage",
    "Garage holds 5+ cars",
    "Warehouse",
    "gold",
    "build",
    cars.length >= 5,
    Math.min(1, cars.length / 5),
  );

  push(
    "first-mod",
    "First wrench",
    "Log your first mod",
    "Wrench",
    "bronze",
    "build",
    installed.length >= 1,
    Math.min(1, installed.length),
  );
  push(
    "ten-mods",
    "Turning point",
    "10 installed mods",
    "Wrench",
    "silver",
    "build",
    installed.length >= 10,
    Math.min(1, installed.length / 10),
  );
  push(
    "twenty-five-mods",
    "Serious builder",
    "25 installed mods",
    "Wrench",
    "gold",
    "build",
    installed.length >= 25,
    Math.min(1, installed.length / 25),
  );
  push(
    "fifty-mods",
    "Obsessed",
    "50 installed mods",
    "Wrench",
    "platinum",
    "build",
    installed.length >= 50,
    Math.min(1, installed.length / 50),
  );

  // ── DIVERSITY ──────────────────────────────────────────────────────────
  push(
    "three-categories",
    "Well rounded",
    "Mods in 3 different categories",
    "Layers",
    "bronze",
    "diversity",
    uniqueCategories >= 3,
    Math.min(1, uniqueCategories / 3),
  );
  push(
    "all-categories",
    "Complete build",
    "At least one mod in every category",
    "Layers",
    "gold",
    "diversity",
    uniqueCategories >= 8,
    Math.min(1, uniqueCategories / 8),
  );

  // ── SPENDING ───────────────────────────────────────────────────────────
  push(
    "first-thousand",
    "$1k club",
    "Invested over $1,000 in mods",
    "DollarSign",
    "bronze",
    "spend",
    totalSpent >= 1000,
    Math.min(1, totalSpent / 1000),
  );
  push(
    "ten-k-club",
    "$10k club",
    "Invested over $10,000 in mods",
    "DollarSign",
    "silver",
    "spend",
    totalSpent >= 10000,
    Math.min(1, totalSpent / 10000),
  );
  push(
    "twenty-five-k-club",
    "$25k club",
    "Invested over $25,000 in mods",
    "DollarSign",
    "gold",
    "spend",
    totalSpent >= 25000,
    Math.min(1, totalSpent / 25000),
  );
  push(
    "fifty-k-club",
    "$50k club",
    "Invested over $50,000 in mods",
    "DollarSign",
    "platinum",
    "spend",
    totalSpent >= 50000,
    Math.min(1, totalSpent / 50000),
  );

  // ── POWER ──────────────────────────────────────────────────────────────
  push(
    "four-hundred-hp",
    "400-hp club",
    "A car in your garage makes 400+ HP",
    "Flame",
    "silver",
    "build",
    maxHP >= 400,
    Math.min(1, maxHP / 400),
  );
  push(
    "six-hundred-hp",
    "600-hp club",
    "A car in your garage makes 600+ HP",
    "Flame",
    "gold",
    "build",
    maxHP >= 600,
    Math.min(1, maxHP / 600),
  );
  push(
    "thousand-hp",
    "Four-digit club",
    "A car in your garage makes 1000+ HP",
    "Flame",
    "platinum",
    "build",
    maxHP >= 1000,
    Math.min(1, maxHP / 1000),
  );

  // ── SPEED ──────────────────────────────────────────────────────────────
  if (bestZeroToSixty != null) {
    push(
      "sub-five",
      "Sub-5 second club",
      "Fastest 0-60 under 5 seconds",
      "Zap",
      "silver",
      "build",
      bestZeroToSixty < 5,
      bestZeroToSixty < 5 ? 1 : Math.max(0, Math.min(1, 1 - (bestZeroToSixty - 5) / 5)),
    );
    push(
      "sub-three",
      "Sub-3 second club",
      "Fastest 0-60 under 3 seconds",
      "Zap",
      "platinum",
      "build",
      bestZeroToSixty < 3,
      bestZeroToSixty < 3 ? 1 : Math.max(0, Math.min(1, 1 - (bestZeroToSixty - 3) / 3)),
    );
  }

  // ── DOCUMENTATION ──────────────────────────────────────────────────────
  push(
    "photographed",
    "Documentarian",
    "Every car has a cover photo",
    "Camera",
    "silver",
    "build",
    cars.length > 0 && carsWithPhoto === cars.length,
    cars.length ? carsWithPhoto / cars.length : 0,
  );
  push(
    "verified",
    "VIN-verified",
    "Any car has a verified VIN",
    "ShieldCheck",
    "silver",
    "build",
    verifiedCars >= 1,
    Math.min(1, verifiedCars),
  );

  // ── DIY ────────────────────────────────────────────────────────────────
  push(
    "self-reliant",
    "Self-reliant",
    "10 DIY installs",
    "HardHat",
    "gold",
    "build",
    diyCount >= 10,
    Math.min(1, diyCount / 10),
  );

  // ── CARDS ──────────────────────────────────────────────────────────────
  push(
    "first-mint",
    "First snapshot",
    "Mint your first pixel card",
    "GalleryHorizontal",
    "bronze",
    "cards",
    cardCount >= 1,
    Math.min(1, cardCount),
  );
  push(
    "five-cards",
    "Collector",
    "Mint 5 pixel cards",
    "GalleryHorizontal",
    "silver",
    "cards",
    cardCount >= 5,
    Math.min(1, cardCount / 5),
  );
  push(
    "twenty-cards",
    "Archivist",
    "Mint 20 pixel cards",
    "GalleryHorizontal",
    "gold",
    "cards",
    cardCount >= 20,
    Math.min(1, cardCount / 20),
  );

  // ── COMMUNITY ──────────────────────────────────────────────────────────
  push(
    "going-public",
    "Going public",
    "Make a car public",
    "Globe",
    "bronze",
    "community",
    publicCars >= 1,
    Math.min(1, publicCars),
  );
  push(
    "first-post",
    "Join the chat",
    "Post in the forum",
    "MessageSquare",
    "bronze",
    "community",
    forumPostCount >= 1,
    Math.min(1, forumPostCount),
  );
  push(
    "active-poster",
    "Community regular",
    "10 forum posts",
    "MessageSquare",
    "silver",
    "community",
    forumPostCount >= 10,
    Math.min(1, forumPostCount / 10),
  );

  return list;
}

export const TIER_COLORS: Record<Milestone["tier"], { bg: string; border: string; text: string; glow: string }> = {
  bronze:   { bg: "rgba(205,127,50,0.13)",  text: "#d4884d", border: "rgba(205,127,50,0.4)",  glow: "rgba(205,127,50,0.3)" },
  silver:   { bg: "rgba(192,192,208,0.13)", text: "#d0d0e0", border: "rgba(192,192,208,0.4)", glow: "rgba(192,192,208,0.3)" },
  gold:     { bg: "rgba(245,215,110,0.13)", text: "#f5d76e", border: "rgba(245,215,110,0.4)", glow: "rgba(245,215,110,0.35)" },
  platinum: { bg: "rgba(168,85,247,0.14)",  text: "#c084fc", border: "rgba(168,85,247,0.5)",  glow: "rgba(168,85,247,0.4)" },
};
