export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji-free: we use CSS/SVG categories
  color: string;
  earned: boolean;
  earnedAt?: string;
}

export interface BadgeInput {
  modCount: number;
  installedModCount: number;
  wishlistCount: number;
  carCount: number;
  carsWithPhoto: number;
  carsWithSpecs: number;
  forumPostCount: number;
  forumReplyCount: number;
  publicCarCount: number;
  modsWithCost: number;
  modsWithNotes: number;
  firstModDate?: string | null;
  firstCarDate?: string | null;
  buildScore: number;
  buildLevel: string;
}

const ALL_BADGES: (Omit<Badge, "earned" | "earnedAt"> & { check: (input: BadgeInput) => boolean })[] = [
  {
    id: "first_car",
    name: "First Ride",
    description: "Added your first vehicle to the garage",
    icon: "car",
    color: "#3B82F6",
    check: (i) => i.carCount >= 1,
  },
  {
    id: "first_mod",
    name: "First Wrench Turn",
    description: "Logged your first mod",
    icon: "wrench",
    color: "#30d158",
    check: (i) => i.modCount >= 1,
  },
  {
    id: "first_photo",
    name: "Show It Off",
    description: "Added a photo to your car",
    icon: "camera",
    color: "#bf5af2",
    check: (i) => i.carsWithPhoto >= 1,
  },
  {
    id: "first_post",
    name: "Community Voice",
    description: "Posted on the forum for the first time",
    icon: "message",
    color: "#ff9f0a",
    check: (i) => i.forumPostCount >= 1,
  },
  {
    id: "first_reply",
    name: "In the Thread",
    description: "Left your first forum reply",
    icon: "reply",
    color: "#60A5FA",
    check: (i) => i.forumReplyCount >= 1,
  },
  {
    id: "mod_5",
    name: "Getting Serious",
    description: "Installed 5 or more mods",
    icon: "zap",
    color: "#3B82F6",
    check: (i) => i.installedModCount >= 5,
  },
  {
    id: "mod_10",
    name: "Build in Progress",
    description: "Installed 10 or more mods",
    icon: "trending",
    color: "#bf5af2",
    check: (i) => i.installedModCount >= 10,
  },
  {
    id: "mod_25",
    name: "Dedicated Builder",
    description: "Installed 25 or more mods — you live at the shop",
    icon: "award",
    color: "#ff9f0a",
    check: (i) => i.installedModCount >= 25,
  },
  {
    id: "specs_filled",
    name: "Specs on Paper",
    description: "Filled in verified vehicle specs",
    icon: "gauge",
    color: "#30d158",
    check: (i) => i.carsWithSpecs >= 1,
  },
  {
    id: "multi_car",
    name: "Fleet Manager",
    description: "Added multiple vehicles to your garage",
    icon: "cars",
    color: "#ffd60a",
    check: (i) => i.carCount >= 2,
  },
  {
    id: "public_build",
    name: "Open Hood",
    description: "Made a car public for the community to see",
    icon: "eye",
    color: "#38bdf8",
    check: (i) => i.publicCarCount >= 1,
  },
  {
    id: "documented",
    name: "By the Numbers",
    description: "Logged costs on 5+ mods — you track the damage",
    icon: "dollar",
    color: "#30d158",
    check: (i) => i.modsWithCost >= 5,
  },
  {
    id: "note_taker",
    name: "Build Journal",
    description: "Added detailed notes to 5+ mods",
    icon: "notes",
    color: "#ff453a",
    check: (i) => i.modsWithNotes >= 5,
  },
  {
    id: "planner",
    name: "Wishlist Warrior",
    description: "Built a wishlist with 5+ planned mods",
    icon: "list",
    color: "#bf5af2",
    check: (i) => i.wishlistCount >= 5,
  },
  {
    id: "enthusiast_level",
    name: "Level: Enthusiast",
    description: "Reached Enthusiast build level",
    icon: "star",
    color: "#30d158",
    check: (i) => ["Enthusiast", "Builder", "Tuner", "Track Rat", "Pioneer", "Legend"].includes(i.buildLevel),
  },
  {
    id: "legend_level",
    name: "LEGEND",
    description: "Reached the highest build level. You are the build.",
    icon: "crown",
    color: "#ffd60a",
    check: (i) => i.buildLevel === "Legend",
  },
  {
    id: "forum_power",
    name: "Forum Regular",
    description: "Posted 10+ times on the forum",
    icon: "flame",
    color: "#ff453a",
    check: (i) => i.forumPostCount >= 10,
  },
];

export function computeBadges(input: BadgeInput): Badge[] {
  return ALL_BADGES.map(({ check, ...badge }) => ({
    ...badge,
    earned: check(input),
  }));
}

export function getEarnedBadges(input: BadgeInput): Badge[] {
  return computeBadges(input).filter((b) => b.earned);
}

export function getNextBadges(input: BadgeInput): Badge[] {
  return computeBadges(input).filter((b) => !b.earned).slice(0, 3);
}

// Icon name → SVG path lookup (for rendering without emojis)
export const BADGE_ICON_PATHS: Record<string, string> = {
  car: "M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l4 4v6a2 2 0 0 1-2 2h-1M9 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
  wrench: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  camera: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  reply: "m9 17-5-5 5-5 M20 18v-2a4 4 0 0 0-4-4H4",
  zap: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  trending: "M22 7 13.5 15.5l-5-5L2 17 M16 7h6v6",
  award: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  gauge: "M12 2a10 10 0 1 0 10 10 M12 12 8.5 8.5",
  cars: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  dollar: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  notes: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  star: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  crown: "M2 20h20 M5 20V8l7-6 7 6v12 M12 20v-5",
  flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
};
