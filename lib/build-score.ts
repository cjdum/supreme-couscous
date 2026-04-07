export interface BuildScoreInput {
  cars: Array<{
    cover_image_url: string | null;
    horsepower: number | null;
    engine_size: string | null;
    specs_ai_guessed?: boolean;
    is_primary?: boolean | null;
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

export const LEVELS = [
  { name: "Stock",      threshold: 0,    description: "Just unboxed it", color: "rgba(255,255,255,0.35)" },
  { name: "Enthusiast", threshold: 50,   description: "Catching the bug", color: "#30d158" },
  { name: "Builder",    threshold: 150,  description: "Wrenching on weekends", color: "#3B82F6" },
  { name: "Tuner",      threshold: 400,  description: "Dyno day regular", color: "#bf5af2" },
  { name: "Track Rat",  threshold: 800,  description: "The car IS the lifestyle", color: "#ff9f0a" },
  { name: "Pioneer",    threshold: 1200, description: "Others reference your build", color: "#ff453a" },
  { name: "Legend",     threshold: 2000, description: "Featured at shows", color: "#ffd60a" },
];

export const LEVEL_COLORS: Record<string, string> = Object.fromEntries(
  LEVELS.map((l) => [l.name, l.color])
);

export function calculateBuildScore(input: BuildScoreInput): BuildScoreResult {
  const { cars, mods, forumPostCount = 0, forumReplyCount = 0 } = input;

  const breakdown: { label: string; points: number }[] = [];

  const installedMods = mods.filter((m) => m.status === "installed");
  const wishlistMods = mods.filter((m) => m.status === "wishlist");

  // Cars with cover photos (+20 each)
  const carsWithPhoto = cars.filter((c) => c.cover_image_url).length;
  if (carsWithPhoto > 0) {
    breakdown.push({ label: `${carsWithPhoto} car photo${carsWithPhoto > 1 ? "s" : ""}`, points: carsWithPhoto * 20 });
  }

  // Cars with verified specs (+10 each)
  const carsWithSpecs = cars.filter(
    (c) => (c.horsepower || c.engine_size) && !c.specs_ai_guessed
  ).length;
  if (carsWithSpecs > 0) {
    breakdown.push({ label: `${carsWithSpecs} car spec${carsWithSpecs > 1 ? "s" : ""} verified`, points: carsWithSpecs * 10 });
  }

  // Base points per installed mod (+10 each)
  if (installedMods.length > 0) {
    breakdown.push({
      label: `${installedMods.length} installed mod${installedMods.length > 1 ? "s" : ""}`,
      points: installedMods.length * 10,
    });
  }

  // Milestone bonuses
  if (installedMods.length >= 5) breakdown.push({ label: "5+ mods milestone", points: 25 });
  if (installedMods.length >= 10) breakdown.push({ label: "10+ mods milestone", points: 50 });
  if (installedMods.length >= 25) breakdown.push({ label: "25+ mods milestone", points: 100 });

  // Documentation quality
  const modsWithCost = installedMods.filter((m) => m.cost != null && m.cost > 0).length;
  if (modsWithCost > 0) {
    breakdown.push({ label: `${modsWithCost} mod${modsWithCost > 1 ? "s" : ""} with cost logged`, points: modsWithCost * 5 });
  }

  const modsWithDate = installedMods.filter((m) => m.install_date).length;
  if (modsWithDate > 0) {
    breakdown.push({ label: `${modsWithDate} mod${modsWithDate > 1 ? "s" : ""} with install date`, points: modsWithDate * 5 });
  }

  const modsWithNotes = installedMods.filter((m) => m.notes && m.notes.trim().length > 0).length;
  if (modsWithNotes > 0) {
    breakdown.push({ label: `${modsWithNotes} mod${modsWithNotes > 1 ? "s" : ""} with notes`, points: modsWithNotes * 3 });
  }

  // Wishlist planning (+2 each)
  if (wishlistMods.length > 0) {
    breakdown.push({ label: `${wishlistMods.length} wishlist item${wishlistMods.length > 1 ? "s" : ""}`, points: wishlistMods.length * 2 });
  }

  // Community participation
  if (forumPostCount > 0) {
    breakdown.push({ label: `${forumPostCount} forum post${forumPostCount > 1 ? "s" : ""}`, points: forumPostCount * 5 });
  }
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
