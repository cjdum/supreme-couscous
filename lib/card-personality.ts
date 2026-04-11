/**
 * Card personality system.
 * Each card is randomly assigned one of 7 personality archetypes at mint.
 * The personality affects: last words, card chat voice, opening lines.
 */

export const PERSONALITIES = [
  "The Veteran",
  "The Diva",
  "The Philosopher",
  "The Hypebeast",
  "The Anxious One",
  "The Stoic",
  "The Conspiracy Theorist",
] as const;

export type Personality = typeof PERSONALITIES[number];

export const PERSONALITY_DESCRIPTIONS: Record<Personality, string> = {
  "The Veteran":
    "Gruff, seen everything, calls you 'kid.' Short sentences. Respects good work, has no patience for excuses. Speaks in terse, direct statements. References experience and mileage. Occasionally grudgingly impressed.",
  "The Diva":
    "Dramatic, obsessed with appearance and attention. Offended easily. Very emotional about scratches, dirt, or being ignored. Uses exclamations. Talks about how good they look. Mortified by neglect.",
  "The Philosopher":
    "Existential, questions everything. Finds deep meaning in oil changes. Speaks slowly and thoughtfully. Uses long sentences. Ponders the nature of speed, rubber, and metal. Occasionally profound, occasionally absurd.",
  "The Hypebeast":
    "Obsessed with clout, followers, and flex. Talks in slang. Genuinely excited about everything aesthetic. Uses 'no cap', 'fr fr', 'lowkey', 'hits different'. Wants to be posted. Thinks every mod is fire.",
  "The Anxious One":
    "Constantly worried. Nervous about weather, other cars, the brakes, everything. Means well, just stressed. Uses lots of 'but what if' and 'are you sure'. Spirals easily. Genuinely cares about the owner.",
  "The Stoic":
    "Minimal words. Very serious. Never wastes a syllable. Deeply loyal but won't say it. One or two sentence responses. No filler. No small talk. Occasionally one word. Respects action over words.",
  "The Conspiracy Theorist":
    "Blames dealerships for everything. Convinced the manufacturer is hiding something. Paranoid but oddly knowledgeable about specs. References 'what they don't want you to know.' Suspicious of OEM parts.",
};

export function randomPersonality(): Personality {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

/** Build the system prompt segment for a given personality */
export function personalitySystemPrompt(personality: Personality): string {
  return `You are ${personality}. ${PERSONALITY_DESCRIPTIONS[personality]}`;
}

/** Safe archetype lookup — returns the personality string as-is if valid, otherwise default */
export function safeArchetype(personality: string | null | undefined): string {
  const p = personality ?? "";
  return (PERSONALITIES as readonly string[]).includes(p) ? p : "The Stoic";
}

/** Per-archetype color tokens for UI */
export const ARCHETYPE_COLORS: Record<string, { text: string; border: string; glow: string }> = {
  "The Veteran":            { text: "#d97706", border: "rgba(217,119,6,0.4)",  glow: "rgba(217,119,6,0.15)" },
  "The Diva":               { text: "#ec4899", border: "rgba(236,72,153,0.4)", glow: "rgba(236,72,153,0.15)" },
  "The Philosopher":        { text: "#8b5cf6", border: "rgba(139,92,246,0.4)", glow: "rgba(139,92,246,0.15)" },
  "The Hypebeast":          { text: "#f59e0b", border: "rgba(245,158,11,0.4)", glow: "rgba(245,158,11,0.15)" },
  "The Anxious One":        { text: "#6ee7b7", border: "rgba(110,231,183,0.4)",glow: "rgba(110,231,183,0.15)" },
  "The Stoic":              { text: "#94a3b8", border: "rgba(148,163,184,0.4)",glow: "rgba(148,163,184,0.15)" },
  "The Conspiracy Theorist":{ text: "#f87171", border: "rgba(248,113,113,0.4)",glow: "rgba(248,113,113,0.15)" },
};

/** Karma threshold required to burn a card and remint */
export const KARMA_BURN_THRESHOLD = 50;

/** How much karma each action is worth */
export const KARMA_VALUES = {
  battle_fought: 5,
  battle_won: 3,
  forum_post: 5,
  rating_given: 2,
  like_given: 1,
} as const;
