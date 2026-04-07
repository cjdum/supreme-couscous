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

export interface ScoreBreakdownItem {
  label: string;
  points: number;
}

export interface ComponentScore {
  score: number;
  breakdown: ScoreBreakdownItem[];
}

export interface BuildScoreResult {
  /** Total VAULT Rating = buildScore.score + communityScore.score */
  score: number;
  /** Build component — pure car/mod stats */
  buildScore: ComponentScore;
  /** Community component — forum activity */
  communityScore: ComponentScore;
  /** Level name (based on total score) */
  level: string;
  levelIndex: number;
  nextLevel: string | null;
  currentThreshold: number;
  nextThreshold: number | null;
  progress: number; // 0-100
  /** Combined breakdown (build items first, then community items) */
  breakdown: ScoreBreakdownItem[];
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

/** Color for the Build Score component (blue, the main product score) */
export const BUILD_SCORE_COLOR = "#3B82F6";
/** Color for the Community Score component (green, community activity) */
export const COMMUNITY_SCORE_COLOR = "#30d158";
/** Color for the combined VAULT Rating (gold, the prominent one) */
export const VAULT_RATING_COLOR = "#fbbf24";

export function calculateBuildScore(input: BuildScoreInput): BuildScoreResult {
  const { cars, mods, forumPostCount = 0, forumReplyCount = 0 } = input;

  // ── BUILD SCORE: pure car/mod stats ──────────────────────────────────────
  const buildBreakdown: ScoreBreakdownItem[] = [];

  const installedMods = mods.filter((m) => m.status === "installed");
  const wishlistMods = mods.filter((m) => m.status === "wishlist");

  // Cars with cover photos (+20 each)
  const carsWithPhoto = cars.filter((c) => c.cover_image_url).length;
  if (carsWithPhoto > 0) {
    buildBreakdown.push({
      label: `${carsWithPhoto} car photo${carsWithPhoto > 1 ? "s" : ""}`,
      points: carsWithPhoto * 20,
    });
  }

  // Cars with verified specs (+10 each)
  const carsWithSpecs = cars.filter(
    (c) => (c.horsepower || c.engine_size) && !c.specs_ai_guessed
  ).length;
  if (carsWithSpecs > 0) {
    buildBreakdown.push({
      label: `${carsWithSpecs} car spec${carsWithSpecs > 1 ? "s" : ""} verified`,
      points: carsWithSpecs * 10,
    });
  }

  // Base points per installed mod (+10 each)
  if (installedMods.length > 0) {
    buildBreakdown.push({
      label: `${installedMods.length} installed mod${installedMods.length > 1 ? "s" : ""}`,
      points: installedMods.length * 10,
    });
  }

  // Milestone bonuses
  if (installedMods.length >= 5) buildBreakdown.push({ label: "5+ mods milestone", points: 25 });
  if (installedMods.length >= 10) buildBreakdown.push({ label: "10+ mods milestone", points: 50 });
  if (installedMods.length >= 25) buildBreakdown.push({ label: "25+ mods milestone", points: 100 });

  // Documentation quality
  const modsWithCost = installedMods.filter((m) => m.cost != null && m.cost > 0).length;
  if (modsWithCost > 0) {
    buildBreakdown.push({
      label: `${modsWithCost} mod${modsWithCost > 1 ? "s" : ""} with cost logged`,
      points: modsWithCost * 5,
    });
  }

  const modsWithDate = installedMods.filter((m) => m.install_date).length;
  if (modsWithDate > 0) {
    buildBreakdown.push({
      label: `${modsWithDate} mod${modsWithDate > 1 ? "s" : ""} with install date`,
      points: modsWithDate * 5,
    });
  }

  const modsWithNotes = installedMods.filter((m) => m.notes && m.notes.trim().length > 0).length;
  if (modsWithNotes > 0) {
    buildBreakdown.push({
      label: `${modsWithNotes} mod${modsWithNotes > 1 ? "s" : ""} with notes`,
      points: modsWithNotes * 3,
    });
  }

  // Wishlist planning (+2 each)
  if (wishlistMods.length > 0) {
    buildBreakdown.push({
      label: `${wishlistMods.length} wishlist item${wishlistMods.length > 1 ? "s" : ""}`,
      points: wishlistMods.length * 2,
    });
  }

  const buildScoreValue = buildBreakdown.reduce((sum, b) => sum + b.points, 0);

  // ── COMMUNITY SCORE: forum activity ──────────────────────────────────────
  const communityBreakdown: ScoreBreakdownItem[] = [];

  if (forumPostCount > 0) {
    communityBreakdown.push({
      label: `${forumPostCount} forum post${forumPostCount > 1 ? "s" : ""}`,
      points: forumPostCount * 5,
    });
  }
  if (forumReplyCount > 0) {
    communityBreakdown.push({
      label: `${forumReplyCount} forum repl${forumReplyCount > 1 ? "ies" : "y"}`,
      points: forumReplyCount * 2,
    });
  }

  // First-post bonus
  if (forumPostCount >= 1) {
    communityBreakdown.push({ label: "First post bonus", points: 5 });
  }
  // Active contributor
  if (forumPostCount >= 10) {
    communityBreakdown.push({ label: "Active contributor (10+ posts)", points: 20 });
  }

  const communityScoreValue = communityBreakdown.reduce((sum, b) => sum + b.points, 0);

  // ── COMBINED VAULT RATING ────────────────────────────────────────────────
  const totalScore = buildScoreValue + communityScoreValue;

  // Level is based on total
  let levelIndex = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalScore >= LEVELS[i].threshold) {
      levelIndex = i;
      break;
    }
  }

  const currentLevel = LEVELS[levelIndex];
  const nextLevelData = LEVELS[levelIndex + 1] ?? null;

  let progress = 100;
  if (nextLevelData) {
    const range = nextLevelData.threshold - currentLevel.threshold;
    const earned = totalScore - currentLevel.threshold;
    progress = Math.min(100, Math.round((earned / range) * 100));
  }

  return {
    score: totalScore,
    buildScore: { score: buildScoreValue, breakdown: buildBreakdown },
    communityScore: { score: communityScoreValue, breakdown: communityBreakdown },
    level: currentLevel.name,
    levelIndex,
    nextLevel: nextLevelData?.name ?? null,
    currentThreshold: currentLevel.threshold,
    nextThreshold: nextLevelData?.threshold ?? null,
    progress,
    breakdown: [...buildBreakdown, ...communityBreakdown],
  };
}
