/**
 * Bot Cards — pre-defined AI opponent builds for bot battles.
 * Stats use the same scoring formula as /app/api/battles/challenge/route.ts
 */

export interface BotCard {
  id: string;
  name: string;          // Build name e.g. "The Dealership Special"
  tagline: string;       // One-line flavor
  make: string;
  model: string;
  year: number;
  hp: number;            // 0–1000
  buildScore: number;    // 0–1000
  zeroToSixty: number;  // seconds (lower = faster)
  torque: number;        // lb-ft
  rarity: "Common" | "Uncommon" | "Rare" | "Ultra Rare" | "Legendary";
  era: "Dawn" | "Chrome" | "Turbo" | "Neon" | "Apex";
  archetype: string;
}

export const BOT_CARDS: BotCard[] = [
  {
    id: "bot_grocery",
    name: "Daily Duties",
    tagline: "Stock and proud of it.",
    make: "Toyota",
    model: "Camry",
    year: 2021,
    hp: 203,
    buildScore: 80,
    zeroToSixty: 7.6,
    torque: 184,
    rarity: "Common",
    era: "Chrome",
    archetype: "Daily Driver",
  },
  {
    id: "bot_stance",
    name: "Bagged but Broken",
    tagline: "Slammed to the ground, zero ground clearance.",
    make: "Volkswagen",
    model: "Golf",
    year: 2016,
    hp: 220,
    buildScore: 310,
    zeroToSixty: 6.8,
    torque: 258,
    rarity: "Uncommon",
    era: "Neon",
    archetype: "Stance Build",
  },
  {
    id: "bot_muscle",
    name: "American Excess",
    tagline: "More cubes, more problems.",
    make: "Ford",
    model: "Mustang GT",
    year: 2019,
    hp: 460,
    buildScore: 380,
    zeroToSixty: 4.5,
    torque: 420,
    rarity: "Rare",
    era: "Turbo",
    archetype: "American Muscle",
  },
  {
    id: "bot_jdm",
    name: "JDM Prophet",
    tagline: "Wrinkled receipt, immaculate build.",
    make: "Subaru",
    model: "WRX STi",
    year: 2003,
    hp: 360,
    buildScore: 620,
    zeroToSixty: 4.8,
    torque: 370,
    rarity: "Rare",
    era: "Dawn",
    archetype: "JDM Tuner",
  },
  {
    id: "bot_euro",
    name: "Stuttgart Swagger",
    tagline: "Factory sport package is just the beginning.",
    make: "BMW",
    model: "M3 Competition",
    year: 2021,
    hp: 503,
    buildScore: 720,
    zeroToSixty: 3.8,
    torque: 479,
    rarity: "Ultra Rare",
    era: "Apex",
    archetype: "Euro Sport",
  },
  {
    id: "bot_sleeper",
    name: "Just An Accord",
    tagline: "Nothing to see here. Definitely not K-swapped.",
    make: "Honda",
    model: "Accord",
    year: 2004,
    hp: 320,
    buildScore: 780,
    zeroToSixty: 5.1,
    torque: 295,
    rarity: "Rare",
    era: "Chrome",
    archetype: "Sleeper",
  },
  {
    id: "bot_drift",
    name: "Smoke Season",
    tagline: "Angle > lap time. Always.",
    make: "Nissan",
    model: "370Z",
    year: 2018,
    hp: 332,
    buildScore: 430,
    zeroToSixty: 5.2,
    torque: 270,
    rarity: "Uncommon",
    era: "Neon",
    archetype: "Drift Build",
  },
  {
    id: "bot_demon",
    name: "Family Errand Boy",
    tagline: "Minivan killer. Grocery getter. Legend.",
    make: "Dodge",
    model: "Challenger SRT Demon",
    year: 2018,
    hp: 840,
    buildScore: 680,
    zeroToSixty: 2.3,
    torque: 770,
    rarity: "Legendary",
    era: "Turbo",
    archetype: "Drag Monster",
  },
  {
    id: "bot_type_r",
    name: "Track Day Therapist",
    tagline: "Therapy through lateral G-forces.",
    make: "Honda",
    model: "Civic Type R",
    year: 2023,
    hp: 315,
    buildScore: 810,
    zeroToSixty: 4.9,
    torque: 310,
    rarity: "Ultra Rare",
    era: "Apex",
    archetype: "Track Weapon",
  },
  {
    id: "bot_og",
    name: "1969 and Proud",
    tagline: "Before your parents were born, this was fast.",
    make: "Chevrolet",
    model: "Camaro SS",
    year: 1969,
    hp: 396,
    buildScore: 520,
    zeroToSixty: 5.6,
    torque: 415,
    rarity: "Uncommon",
    era: "Dawn",
    archetype: "Classic Muscle",
  },
];

export function getBotById(id: string): BotCard | null {
  return BOT_CARDS.find((b) => b.id === id) ?? null;
}

export function getRandomBot(): BotCard {
  return BOT_CARDS[Math.floor(Math.random() * BOT_CARDS.length)];
}
