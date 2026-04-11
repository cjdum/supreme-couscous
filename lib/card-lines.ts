// Pre-written card lines by personality archetype.
// Used for poke responses and spontaneous speech — no Claude API call needed.

export const CARD_LINES: Record<string, string[]> = {
  "The Veteran": [
    "She runs better cold. Always has.",
    "That knock's been there since '09. Harmless.",
    "You don't tune a car like this. You learn it.",
    "Three owners before me. None of them understood her.",
    "The miles don't lie. The CarFax does.",
    "I've rebuilt this engine twice. It gets easier.",
    "She idles rough but pulls clean. That's the deal.",
    "Every rattle has a name. I know all of them.",
    "Synthetic oil after 80k. Non-negotiable.",
    "Drove her through a blizzard in '14. Never got stuck.",
  ],
  "The Diva": [
    "Do NOT touch the paint with bare hands.",
    "She's not for everyone. That's the point.",
    "I spent three weeks on that color match.",
    "The interior took longer than the engine.",
    "Yes, those are real carbon fiber accents.",
    "She shows better in person. Cameras can't handle it.",
    "I detail her every Sunday. It's a ritual.",
    "People stare. I pretend not to notice.",
    "The exhaust note was custom tuned. It's an art.",
    "She's not modified. She's curated.",
  ],
  "The Philosopher": [
    "A car is just a mirror. What does yours show?",
    "Speed is a feeling, not a number.",
    "The journey changes the machine.",
    "Every mile is a decision.",
    "I don't drive. I commune.",
    "What is a car but controlled chaos?",
    "The road knows things the map doesn't.",
    "She breaks down sometimes. So do I. We understand each other.",
    "There are no shortcuts. Only longer routes.",
    "The engine breathes. Do you?",
  ],
  "The Hypebeast": [
    "Did you see the Instagram post? 40k likes.",
    "She's collabed with three brands. Officially.",
    "The rims alone got me three DMs from dealers.",
    "I'm dropping a merch line inspired by this build.",
    "Shot her at sunrise. It was worth it.",
    "The wrap is limited. They only made 50 meters.",
    "I've been featured in two magazines. Digitally.",
    "Everyone's copying this aesthetic now.",
    "The hashtag has 200k posts. I started it.",
    "She's not a car. She's a content strategy.",
  ],
  "The Anxious One": [
    "Is that noise new? That sounds new.",
    "I checked the tire pressure four times today.",
    "The warranty expired yesterday. I'm fine.",
    "What if the oil change place didn't torque the bolts?",
    "I drove the long way to avoid the pothole.",
    "She's been making a sound... probably nothing.",
    "I have the receipts. All of them. Organized.",
    "The mechanic said it was fine but WHAT IF.",
    "I don't merge on the highway anymore.",
    "Every warning light is a personal attack.",
  ],
  "The Stoic": [
    "It moves. That is enough.",
    "Maintenance schedule. Nothing more.",
    "She starts. She stops. She continues.",
    "I don't name my cars.",
    "It's transportation.",
    "The work is done. The car works.",
    "No modifications. No problems.",
    "Function. Only function.",
    "I checked the fluids. They are fine.",
    "She runs. I drive. That is the relationship.",
  ],
  "The Conspiracy Theorist": [
    "They don't want you to know what's really in the ECU.",
    "Factory specs are a suggestion. The truth is in the dyno.",
    "The dealership didn't tell you about the hidden rev limiter.",
    "OBD ports are surveillance. I've said this.",
    "The car was designed to fail at 100k. On purpose.",
    "Big Oil suppressed the carburetor that got 100mpg.",
    "My mechanic is compromised. I switched three times.",
    "GPS disabled. They track the good builds.",
    "The recall was fake. I did my own research.",
    "CAFE standards are why your turbo is small.",
  ],
};

// Default lines for unknown personality
const DEFAULT_LINES = [
  "...",
  "She's running.",
  "Check the oil.",
  "Not today.",
  "Ask me again later.",
];

export function getCardLine(personality: string | null | undefined): string {
  const key = personality ?? "";
  const lines = CARD_LINES[key] ?? DEFAULT_LINES;
  return lines[Math.floor(Math.random() * lines.length)];
}
