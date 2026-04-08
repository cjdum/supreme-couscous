import { HelpCircle, ShieldCheck, Swords, Star, Flag, Users, Trophy, Gauge, Sparkles, Layers } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";

export const metadata = { title: "How It Works — MODVAULT" };

const SECTIONS = [
  {
    icon: Sparkles,
    title: "Cards",
    body: [
      "A card is a permanent snapshot of a car at a meaningful build moment. Cards are minted, not edited — once you confirm and mint, the card is frozen.",
      "Before minting, the AI assembles everything it knows from the typed fields on your car and mod list. It never sees photos. You then review the title, performance stats, traits, and weaknesses on a verification screen before committing.",
      "Cards have a front (visual summary) and back (full truth — every mod, cost, install date, stock baseline, and authenticity signals).",
    ],
  },
  {
    icon: Gauge,
    title: "Builder Score",
    body: [
      "Your Builder Score is a per-user credibility rating from 0 to 1000. It has five components:",
      "· Documentation quality (25%) — are your mods tracked with cost, date, notes, and photos?",
      "· Community trust (25%) — the weighted average rating and endorsement balance across your minted cards.",
      "· Engagement authenticity (20%) — how accurate your flags turn out to be compared to community consensus.",
      "· Build consistency (15%) — are you logging steadily, or dumping ten mods at once?",
      "· Platform tenure (15%) — how long you've been active.",
      "Tiers: Newcomer 0–199, Enthusiast 200–399, Builder 400–599, Respected 600–799, Authority 800–999, Legend 1000.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Traits",
    body: [
      "Traits are earned, not random. Every trait is tied to a verifiable action or signal. The full list: Authenticated (VIN verified), Builder (5+ fully documented mods), Respected (avg rating 4.0+ from Builder 400+ users), Veteran (6+ months, 3+ cards), Specialist (70% of mods in one category), Sleeper (big HP gain on a modest base), Show Quality (high photo count + strong presence), Community Pick (top 5% in archetype this month), and Controversial (simultaneously flagged and endorsed).",
      "The pre-mint review shows you every trait with the reason it was or wasn't earned.",
    ],
  },
  {
    icon: Star,
    title: "Community Rating",
    body: [
      "Ratings have four dimensions, each 1–5: Cleanliness, Creativity, Execution, Presence.",
      "Your rating weight scales with your Builder Score tier: Newcomer 0.5×, Enthusiast 0.75×, Builder 1.0×, Respected 1.5×, Authority 2.0×, Legend 3.0×.",
      "Only the weighted average is ever shown. You can update your rating, but you can't rate your own card.",
    ],
  },
  {
    icon: Flag,
    title: "Flagging and Endorsement",
    body: [
      "Anyone can flag a card as unbelievable or endorse it as credible. Your signal weight scales with your Builder Score.",
      "Sub-200 Builder Score flags count at 25% of normal so noise from brand-new accounts can't sink real builds.",
      "If the combined flag weight crosses a threshold, the card gets a Community Questioned badge and its authenticity confidence drops. The owner can respond with evidence.",
      "Users whose flags keep getting overruled by high-credibility endorsements lose flag weight over time.",
    ],
  },
  {
    icon: Swords,
    title: "Battles",
    body: [
      "You challenge another card with one of your own. The battle is resolved by a transparent formula: performance (35%), archetype matchup (20%), authenticity confidence (20%), Builder Score delta (15%), and a seeded RNG roll (10%).",
      "Track beats Street. Show loses performance matchups. Sleeper gets a surprise bonus against non-Sleepers. Cards with authenticity confidence under 30 cannot initiate battles.",
      "There is no card destruction — the stakes are reputation only. Each card has a 24-hour cooldown between battles.",
    ],
  },
  {
    icon: Users,
    title: "Feed",
    body: [
      "The feed has four tabs: For You (personalized by car similarity, recency, quality, and archetype diversity), New Builds (recency), Top Rated (filterable by archetype), and Battle Leaders (win rate, minimum 3 battles).",
      "The For You algorithm injects a new archetype every 8th card so you see more than just your own bubble.",
    ],
  },
  {
    icon: Trophy,
    title: "Achievements",
    body: [
      "Achievements are the single unified milestone system — no more separate badges, milestones, and awards. Each achievement shows live progress toward it even before you earn it. Categories: Builder, Community, Battle, Platform.",
    ],
  },
  {
    icon: Layers,
    title: "Stock Spec Baseline",
    body: [
      "Every performance number (HP, torque, 0-60, top speed) is anchored to the car's stock baseline from our lookup table, then adjusted by realistic mod deltas. If the exact car isn't in our table, the AI says so and gives conservative numbers.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="4xl" className="pt-10 pb-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-[var(--color-accent-muted)]" style={{ border: "1px solid rgba(59,130,246,0.3)" }}>
            <HelpCircle size={18} style={{ color: "var(--color-accent)" }} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">How MODVAULT works</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Plain-language docs for every system.</p>
          </div>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <section
                key={s.title}
                className="rounded-2xl p-6"
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg" style={{ background: "var(--color-accent-muted)", border: "1px solid rgba(59,130,246,0.25)" }}>
                    <Icon size={14} style={{ color: "var(--color-accent)" }} />
                  </div>
                  <h2 className="text-base font-black text-[var(--color-text-primary)] tracking-tight">{s.title}</h2>
                </div>
                <div className="space-y-3 text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                  {s.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </PageContainer>
    </div>
  );
}
