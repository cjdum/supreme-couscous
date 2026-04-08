import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TradingCard } from "@/components/garage/trading-card";
import { ERA_COLORS, safeEra } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";
import { CardShareActions } from "@/components/garage/card-share-actions";
import { CardJudgePanel } from "@/components/garage/card-judge-panel";
import type { CardTrait } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("pixel_cards")
    .select("nickname, car_snapshot, occasion, flavor_text, era, card_number")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { title: "Card not found — MODVAULT" };

  const snap = (data as { car_snapshot: { year: number; make: string; model: string } }).car_snapshot;
  const era = safeEra((data as { era: string | null }).era);
  const num = (data as { card_number: number | null }).card_number;
  const title = `${snap.year} ${snap.make} ${snap.model} · ${(data as { nickname: string }).nickname} — MODVAULT`;
  const description =
    (data as { flavor_text: string | null }).flavor_text ??
    `A ${era} era pixel card${num != null ? ` · #${String(num).padStart(4, "0")}` : ""} minted on MODVAULT.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [`/c/${id}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/c/${id}/opengraph-image`],
    },
  };
}

export default async function PublicCardPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Get current viewer (optional — page is public)
  const { data: { user: viewerUser } } = await supabase.auth.getUser();
  const viewerUserId = viewerUser?.id ?? null;

  const { data: cardRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!cardRaw) notFound();
  const card = cardRaw as MintedCard;

  // Find the owner username (optional — only shown if they have a profile)
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, is_public")
    .eq("user_id", card.user_id)
    .maybeSingle();
  const profile = profileRaw as { username: string; display_name: string | null; avatar_url: string | null; is_public: boolean } | null;

  const era      = safeEra(card.era);
  const eraStyle = ERA_COLORS[era];
  const snap     = card.car_snapshot;
  const carLabel = `${snap.year} ${snap.make} ${snap.model}`;
  const mintDate = new Date(card.minted_at).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  // Show a couple neighboring cards from the same user as a "more from this builder" rail
  const { data: moreRaw } = await supabase
    .from("pixel_cards")
    .select("id, pixel_card_url, nickname, car_snapshot, era, card_number")
    .eq("user_id", card.user_id)
    .neq("id", id)
    .order("minted_at", { ascending: false })
    .limit(4);
  const more = (moreRaw ?? []) as Array<{
    id: string; pixel_card_url: string; nickname: string;
    car_snapshot: { year: number; make: string; model: string };
    era: string | null; card_number: number | null;
  }>;

  // Ratings
  const { data: ratingsRaw } = await supabase
    .from("card_ratings")
    .select("cleanliness, creativity, execution, presence, weighted_composite")
    .eq("card_id", id);
  const ratings = (ratingsRaw ?? []) as {
    cleanliness: number;
    creativity: number;
    execution: number;
    presence: number;
    weighted_composite: number;
  }[];
  const avgRating =
    ratings.length > 0
      ? ratings.reduce((s, r) => s + Number(r.weighted_composite), 0) / ratings.length
      : null;

  // Battle history (last 5)
  const { data: battleRaw } = await supabase
    .from("card_battles")
    .select("id, outcome, challenger_card_id, opponent_card_id, created_at")
    .or(`challenger_card_id.eq.${id},opponent_card_id.eq.${id}`)
    .order("created_at", { ascending: false })
    .limit(5);
  const battles = (battleRaw ?? []) as {
    id: string;
    outcome: "win" | "loss" | "narrow_win" | "narrow_loss";
    challenger_card_id: string;
    opponent_card_id: string;
    created_at: string;
  }[];

  // Credibility signal counts (aggregate only — raw identities are RLS-gated)
  const { data: sigsRaw } = await supabase
    .from("card_credibility_signals")
    .select("signal_type, weight")
    .eq("card_id", id);
  type Sig = { signal_type: "flag" | "endorse"; weight: number };
  const sigs = (sigsRaw ?? []) as Sig[];
  const endorseWeight = sigs.filter((s) => s.signal_type === "endorse").reduce((s, x) => s + Number(x.weight), 0);
  const flagWeight = sigs.filter((s) => s.signal_type === "flag").reduce((s, x) => s + Number(x.weight), 0);

  const totalMods = snap.mod_count ?? 0;
  const totalInvested = snap.total_invested ?? 0;

  // Read the new fields safely (they default to null on old rows)
  const traits = (card as unknown as { traits: CardTrait[] | null }).traits ?? [];
  const archetype = (card as unknown as { build_archetype: string | null }).build_archetype ?? null;
  const authenticity = (card as unknown as { authenticity_confidence: number | null }).authenticity_confidence ?? null;
  const uniqueness = (card as unknown as { uniqueness_score: number | null }).uniqueness_score ?? null;
  const aggression = (card as unknown as { build_aggression: number | null }).build_aggression ?? null;
  const weaknesses = (card as unknown as { weaknesses: string[] | null }).weaknesses ?? [];
  const battleRecord = (card as unknown as { battle_record: { wins: number; losses: number } | null }).battle_record ?? { wins: 0, losses: 0 };
  const cardTitle = (card as unknown as { card_title: string | null }).card_title ?? null;

  return (
    <main
      className="min-h-dvh relative overflow-x-hidden"
      style={{
        backgroundColor: "#05050c",
        color: "#f4f0ff",
      }}
    >
      {/* Ambient era-tinted background */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: [
            `radial-gradient(ellipse 70% 50% at 50% -10%, ${eraStyle.glow} 0%, transparent 60%)`,
            "radial-gradient(ellipse 60% 40% at 20% 50%, rgba(91,33,182,0.2) 0%, transparent 60%)",
            "linear-gradient(180deg, #05050c 0%, #08061a 40%, #05050c 100%)",
          ].join(", "),
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(168,85,247,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 80%)",
        }}
      />

      {/* Top bar */}
      <nav
        className="sticky top-0 z-40 backdrop-blur-lg"
        style={{
          background: "rgba(5,5,12,0.7)",
          borderBottom: "1px solid rgba(168,85,247,0.15)",
        }}
      >
        <div className="flex items-center justify-between h-14 px-5 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                boxShadow: "0 0 14px rgba(168,85,247,0.45)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <span
              className="font-black text-xs uppercase"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.18em", color: "#fff" }}
            >
              MODVAULT
            </span>
          </Link>
          <Link
            href="/signup"
            className="h-8 px-4 text-xs font-bold rounded-lg inline-flex items-center"
            style={{
              background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(168,85,247,0.4)",
            }}
          >
            Start your vault
          </Link>
        </div>
      </nav>

      {/* Content */}
      <section className="relative z-10 px-5 pt-10 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-10 items-start">
          {/* Card */}
          <div className="flex flex-col items-center gap-5">
            <TradingCard
              cardUrl={card.pixel_card_url}
              nickname={card.nickname}
              generatedAt={card.minted_at}
              hp={card.hp}
              modCount={card.mod_count}
              buildScore={snap.build_score}
              vinVerified={snap.vin_verified}
              cardNumber={card.card_number}
              era={card.era}
              flavorText={card.flavor_text}
              occasion={card.occasion}
              mods={snap.mods ?? []}
              modsDetail={snap.mods_detail}
              torque={snap.torque ?? null}
              zeroToSixty={snap.zero_to_sixty ?? null}
              totalInvested={snap.total_invested ?? null}
              carLabel={carLabel}
              scale={1.1}
              idle
              interactive
            />
            <CardShareActions cardId={card.id} carLabel={carLabel} />
          </div>

          {/* Info panel */}
          <div className="min-w-0">
            <div
              className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full"
              style={{
                background: eraStyle.bg,
                border: `1px solid ${eraStyle.border}`,
                boxShadow: `0 0 12px ${eraStyle.glow}`,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: eraStyle.text }} />
              <span
                className="text-[10px] font-black uppercase"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.22em", color: eraStyle.text }}
              >
                {era} Era
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-white leading-tight">
              {carLabel}
            </h1>
            <p
              className="text-lg mb-6"
              style={{ color: "#f5d76e", fontFamily: "ui-monospace, monospace", letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              {card.nickname}
            </p>

            {card.card_number != null && (
              <p
                className="text-xs mb-6"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.12em",
                  color: "rgba(200,180,240,0.6)",
                }}
              >
                Card #{String(card.card_number).padStart(4, "0")} · Minted {mintDate}
              </p>
            )}

            {/* Occasion */}
            {card.occasion && (
              <div
                className="mb-6 p-4 rounded-2xl"
                style={{
                  background: eraStyle.bg,
                  border: `1px solid ${eraStyle.border}`,
                  boxShadow: `0 0 16px ${eraStyle.glow}`,
                }}
              >
                <p
                  className="text-[9px] mb-1"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(200,180,240,0.65)",
                    fontWeight: 700,
                  }}
                >
                  Occasion
                </p>
                <p
                  className="italic text-sm"
                  style={{ color: eraStyle.text, fontFamily: "ui-monospace, monospace", lineHeight: 1.6 }}
                >
                  &ldquo;{card.occasion}&rdquo;
                </p>
              </div>
            )}

            {/* Flavor text */}
            {card.flavor_text && (
              <div
                className="mb-6 p-4 rounded-2xl"
                style={{
                  background: "rgba(123,79,212,0.08)",
                  border: "1px solid rgba(123,79,212,0.25)",
                }}
              >
                <p
                  className="text-[9px] mb-1"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(200,180,240,0.55)",
                    fontWeight: 700,
                  }}
                >
                  Description
                </p>
                <p
                  className="italic text-sm"
                  style={{ color: "rgba(220,210,250,0.85)", fontFamily: "ui-monospace, monospace", lineHeight: 1.7 }}
                >
                  {card.flavor_text}
                </p>
              </div>
            )}

            {/* Stat grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "HP",    value: card.hp ?? "—" },
                { label: "TRQ",   value: snap.torque ?? "—" },
                { label: "MODS",  value: totalMods },
                { label: "SPENT", value: totalInvested > 0 ? `$${(totalInvested / 1000).toFixed(1)}k` : "—" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: "rgba(15,12,30,0.6)",
                    border: "1px solid rgba(168,85,247,0.2)",
                  }}
                >
                  <p
                    className="text-[9px] mb-1"
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: "0.14em",
                      color: "rgba(200,180,240,0.5)",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    {s.label}
                  </p>
                  <p
                    className="text-lg font-black"
                    style={{ fontFamily: "ui-monospace, monospace", color: "#fff" }}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* VIN badge */}
            {snap.vin_verified && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-6" style={{
                background: "rgba(245,215,110,0.13)",
                border: "1px solid rgba(245,215,110,0.45)",
              }}>
                <ShieldCheck size={12} style={{ color: "#f5d76e" }} />
                <span className="text-[9px] font-black uppercase" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em", color: "#f5d76e" }}>
                  VIN Verified
                </span>
              </div>
            )}

            {/* Builder profile */}
            {profile?.is_public && (
              <Link
                href={`/u/${profile.username}`}
                className="inline-flex items-center gap-3 p-3 rounded-2xl mb-6 w-full sm:w-auto"
                style={{
                  background: "rgba(15,12,30,0.6)",
                  border: "1px solid rgba(168,85,247,0.25)",
                  textDecoration: "none",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                  }}
                >
                  {profile.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <span className="text-sm font-black text-white uppercase">{profile.username[0]}</span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.14em", color: "rgba(200,180,240,0.55)" }}>
                    Minted by
                  </p>
                  <p className="text-sm font-black text-white">@{profile.username}</p>
                </div>
                <ArrowRight size={16} className="ml-auto" style={{ color: "rgba(200,180,240,0.4)" }} />
              </Link>
            )}

            {/* ── Card Judge panel — ratings, flags, traits, battles, breakdown ── */}
            <CardJudgePanel
              cardId={card.id}
              cardOwnerId={card.user_id}
              viewerUserId={viewerUserId}
              cardTitle={cardTitle ?? card.nickname}
              archetype={archetype}
              authenticityConfidence={authenticity}
              uniquenessScore={uniqueness}
              buildAggression={aggression}
              traits={traits}
              weaknesses={weaknesses}
              avgRating={avgRating}
              ratingCount={ratings.length}
              endorseWeight={endorseWeight}
              flagWeight={flagWeight}
              battleWins={battleRecord.wins}
              battleLosses={battleRecord.losses}
              battles={battles}
            />

            {/* Mods list */}
            {snap.mods && snap.mods.length > 0 && (
              <div className="mb-6">
                <p
                  className="text-[9px] mb-3"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(200,180,240,0.55)",
                    fontWeight: 700,
                  }}
                >
                  Mods at mint ({snap.mods.length})
                </p>
                <ul className="space-y-1.5">
                  {snap.mods.map((m, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm"
                      style={{ fontFamily: "ui-monospace, monospace", color: "rgba(210,200,240,0.8)" }}
                    >
                      <span style={{ color: "#a855f7", flexShrink: 0 }}>›</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA banner */}
            <div
              className="mt-8 p-5 rounded-2xl flex items-center gap-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(123,79,212,0.15) 0%, rgba(168,85,247,0.08) 100%)",
                border: "1px solid rgba(168,85,247,0.3)",
              }}
            >
              <Sparkles size={20} style={{ color: "#e9d5ff", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Build your own vault</p>
                <p className="text-xs" style={{ color: "rgba(200,180,240,0.6)" }}>
                  Track every mod. Mint cards. Free forever.
                </p>
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1 h-9 px-4 rounded-lg text-xs font-bold flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Start
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* More from this builder */}
        {more.length > 0 && (
          <div className="max-w-5xl mx-auto mt-16">
            <p
              className="text-[10px] mb-4"
              style={{
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(200,180,240,0.55)",
                fontWeight: 800,
              }}
            >
              More from this vault
            </p>
            <div
              className="flex gap-4 overflow-x-auto"
              style={{ scrollbarWidth: "none", padding: "12px 2px" }}
            >
              {more.map((m) => (
                <Link
                  key={m.id}
                  href={`/c/${m.id}`}
                  className="flex-shrink-0"
                  style={{ textDecoration: "none" }}
                >
                  <TradingCard
                    cardUrl={m.pixel_card_url}
                    nickname={m.nickname}
                    generatedAt={null}
                    hp={null}
                    modCount={null}
                    buildScore={null}
                    cardNumber={m.card_number}
                    era={m.era}
                    carLabel={`${m.car_snapshot.year} ${m.car_snapshot.make} ${m.car_snapshot.model}`}
                    scale={0.55}
                    idle
                    interactive={false}
                  />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <footer
        className="relative z-10 py-8 px-5"
        style={{ borderTop: "1px solid rgba(168,85,247,0.12)" }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs"
            style={{
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(200,180,240,0.55)",
            }}
          >
            <ArrowLeft size={12} />
            Back to modvault
          </Link>
          <p
            className="text-[10px]"
            style={{
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.18em",
              color: "rgba(160,140,200,0.4)",
              textTransform: "uppercase",
            }}
          >
            Permanent. Shareable. Yours.
          </p>
        </div>
      </footer>
    </main>
  );
}
