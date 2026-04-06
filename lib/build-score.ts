export interface BuildScoreInput {
  cars: Array<{
    cover_image_url: string | null;
    horsepower: number | null;
    engine_size: string | null;
    specs_ai_guessed?: boolean;
  }>;
  mods: Array<{
    status: string;
    cost: number | null;
    install_date: string | null;
    notes: string | null;
  }>;
  forumPostCount?: number;
  forumReplyCount?: number;
}

export interface BuildScoreResult {
  score: number;
  level: string;
  levelIndex: number;
  nextLevel: string | null;
  currentThreshold: number;
  nextThreshold: number | null;
  progress: number; // 0-100
  breakdown: { label: string; points: number }[];
}

const LEVELS = [
  { name: "Stock", threshold: 0 },
  { name: "Enthusiast", threshold: 50 },
  { name: "Builder", threshold: 150 },
  { name: "Tuner", threshold: 400 },
  { name: "Track Day", threshold: 800 },
  { name: "Legend", threshold: 1500 },
];

export function calculateBuildScore(input: BuildScoreInput): BuildScoreResult {
  const { cars, mods, forumPostCount = 0, forumReplyCount = 0 } = input;

  const breakdown: { label: string; points: number }[] = [];

  const installedMods = mods.filter((m) => m.status === "installed");
  const wishlistMods = mods.filter((m) => m.status === "wishlist");

  // Cars with cover photos
  const carsWithPhoto = cars.filter((c) => c.cover_image_url).length;
  if (carsWithPhoto > 0) {
    const pts = carsWithPhoto * 20;
    breakdown.push({ label: `${carsWithPhoto} car photo${carsWithPhoto > 1 ? "s" : ""}`, points: pts });
  }

  // Cars with real specs
  const carsWithSpecs = cars.filter(
    (c) => (c.horsepower || c.engine_size) && !c.specs_ai_guessed
  ).length;
  if (carsWithSpecs > 0) {
    const pts = carsWithSpecs * 10;
    breakdown.push({ label: `${carsWithSpecs} car spec${carsWithSpecs > 1 ? "s" : ""} filled`, points: pts });
  }

  // Installed mods
  if (installedMods.length > 0) {
    breakdown.push({ label: `${installedMods.length} installed mod${installedMods.length > 1 ? "s" : ""}`, points: installedMods.length * 10 });
  }

  // Mods with cost
  const modsWithCost = installedMods.filter((m) => m.cost != null && m.cost > 0).length;
  if (modsWithCost > 0) {
    breakdown.push({ label: `${modsWithCost} mod${modsWithCost > 1 ? "s" : ""} with cost`, points: modsWithCost * 5 });
  }

  // Mods with install date
  const modsWithDate = installedMods.filter((m) => m.install_date).length;
  if (modsWithDate > 0) {
    breakdown.push({ label: `${modsWithDate} mod${modsWithDate > 1 ? "s" : ""} with date`, points: modsWithDate * 5 });
  }

  // Mods with notes
  const modsWithNotes = installedMods.filter((m) => m.notes && m.notes.trim().length > 0).length;
  if (modsWithNotes > 0) {
    breakdown.push({ label: `${modsWithNotes} mod${modsWithNotes > 1 ? "s" : ""} with notes`, points: modsWithNotes * 3 });
  }

  // Wishlist items
  if (wishlistMods.length > 0) {
    breakdown.push({ label: `${wishlistMods.length} wishlist item${wishlistMods.length > 1 ? "s" : ""}`, points: wishlistMods.length * 2 });
  }

  // Forum posts
  if (forumPostCount > 0) {
    breakdown.push({ label: `${forumPostCount} forum post${forumPostCount > 1 ? "s" : ""}`, points: forumPostCount * 5 });
  }

  // Forum replies
  if (forumReplyCount > 0) {
    breakdown.push({ label: `${forumReplyCount} forum repl${forumReplyCount > 1 ? "ies" : "y"}`, points: forumReplyCount * 2 });
  }

  const score = breakdown.reduce((sum, b) => sum + b.points, 0);

  // Find current level
  let levelIndex = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (score >= LEVELS[i].threshold) {
      levelIndex = i;
      break;
    }
  }

  const currentLevel = LEVELS[levelIndex];
  const nextLevelData = LEVELS[levelIndex + 1] ?? null;

  let progress = 100;
  if (nextLevelData) {
    const range = nextLevelData.threshold - currentLevel.threshold;
    const earned = score - currentLevel.threshold;
    progress = Math.min(100, Math.round((earned / range) * 100));
  }

  return {
    score,
    level: currentLevel.name,
    levelIndex,
    nextLevel: nextLevelData?.name ?? null,
    currentThreshold: currentLevel.threshold,
    nextThreshold: nextLevelData?.threshold ?? null,
    progress,
    breakdown,
  };
}

export const LEVEL_COLORS: Record<string, string> = {
  Stock: "var(--color-text-muted)",
  Enthusiast: "#30d158",
  Builder: "#3B82F6",
  Tuner: "#bf5af2",
  "Track Day": "#ff9f0a",
  Legend: "#ffd60a",
};
