import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryCarId } from "@/lib/supabase/get-primary-car";
import { PageContainer } from "@/components/ui/page-container";
import { safeRarity, RARITY_COLORS, safeEra, ERA_COLORS } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";
import type { PixelCardSnapshot } from "@/lib/supabase/types";

export const metadata = { title: "Card Timeline — MODVAULT" };

// ── Extended row shape (columns added after initial schema) ──────────────────
interface TimelineCard extends MintedCard {
  card_title: string | null;
  nickname: string;
  personality: string | null;
  last_words: string | null;
  burned_at: string | null;
  card_level: number | null;
  status: "alive" | "ghost" | string | null;
  build_archetype: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function carLabel(snap: PixelCardSnapshot): string {
  return [snap.year, snap.make, snap.model].filter(Boolean).join(" ");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RarityChip({ rarity }: { rarity: string }) {
  const r = safeRarity(rarity);
  const c = RARITY_COLORS[r];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {r}
    </span>
  );
}

function EraChip({ era }: { era: string }) {
  const e = safeEra(era);
  const c = ERA_COLORS[e];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {e}
    </span>
  );
}

function PersonalityChip({
  personality,
  muted,
}: {
  personality: string | null;
  muted?: boolean;
}) {
  if (!personality) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        background: muted
          ? "rgba(168,85,247,0.06)"
          : "rgba(168,85,247,0.12)",
        color: muted ? "rgba(192,132,252,0.55)" : "rgba(192,132,252,0.9)",
        border: muted
          ? "1px solid rgba(168,85,247,0.12)"
          : "1px solid rgba(168,85,247,0.28)",
      }}
    >
      {personality}
    </span>
  );
}

function LevelBadge({
  level,
  muted,
}: {
  level: number | null;
  muted?: boolean;
}) {
  if (!level) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 800,
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.06em",
        background: muted
          ? "rgba(123,79,212,0.07)"
          : "rgba(123,79,212,0.18)",
        color: muted ? "rgba(168,85,247,0.4)" : "#a855f7",
        border: muted
          ? "1px solid rgba(123,79,212,0.12)"
          : "1px solid rgba(123,79,212,0.35)",
      }}
    >
      LVL {level}
    </span>
  );
}

// ── Skull SVG icon ────────────────────────────────────────────────────────────
function SkullIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <path d="M8 20v2h3v-2" />
      <path d="M16 20v2h-3v-2" />
      <path d="M18 10a6 6 0 1 0-12 0c0 2.21.9 4.2 2.35 5.65L9 17h6l.65-1.35A7.97 7.97 0 0 0 18 10z" />
    </svg>
  );
}

// ── Living card section ───────────────────────────────────────────────────────
function LivingCard({ card }: { card: TimelineCard }) {
  const displayName = card.card_title ?? card.nickname;
  const snap = card.car_snapshot;

  return (
    <section aria-label="Your living card" style={{ marginBottom: 40 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {/* Pulse dot */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#a855f7",
            boxShadow: "0 0 0 3px rgba(168,85,247,0.25)",
            flexShrink: 0,
            display: "inline-block",
          }}
          aria-hidden="true"
        />
        <h2
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#a855f7",
          }}
        >
          Your Living Card
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          padding: 24,
          borderRadius: 20,
          background: "rgba(123,79,212,0.07)",
          border: "1px solid rgba(168,85,247,0.6)",
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.12), 0 8px 32px rgba(168,85,247,0.15)",
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {/* Card image */}
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              width: 200,
              borderRadius: 14,
              overflow: "hidden",
              border: "2px solid rgba(168,85,247,0.55)",
              boxShadow: "0 4px 24px rgba(168,85,247,0.3)",
            }}
          >
            <Image
              src={card.pixel_card_url}
              alt={`Card: ${displayName}`}
              width={200}
              height={280}
              style={{ display: "block", width: "100%", height: "auto" }}
              priority
            />
          </div>
        </div>

        {/* Card details */}
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 900,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.04em",
              color: "var(--color-text-primary)",
              marginBottom: 10,
              lineHeight: 1.2,
            }}
          >
            {displayName}
          </h3>

          {/* Chip row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 14,
            }}
          >
            <PersonalityChip personality={card.personality} />
            <RarityChip rarity={card.rarity} />
            <EraChip era={card.era} />
            <LevelBadge level={card.card_level} />
          </div>

          {/* Meta rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <MetaRow
              label="Car"
              value={carLabel(snap)}
            />
            {card.occasion && (
              <MetaRow label="Occasion" value={card.occasion} />
            )}
            <MetaRow
              label="Alive since"
              value={fmtDate(card.minted_at)}
              highlight
            />
            {card.hp != null && (
              <MetaRow label="HP" value={`${card.hp} hp`} />
            )}
            {card.mod_count != null && card.mod_count > 0 && (
              <MetaRow label="Mods" value={`${card.mod_count} installed`} />
            )}
            {card.build_archetype && (
              <MetaRow label="Archetype" value={card.build_archetype} />
            )}
          </div>

          {card.flavor_text && (
            <p
              style={{
                marginTop: 14,
                fontSize: 12,
                lineHeight: 1.6,
                color: "var(--mv-panel-text-muted)",
                fontStyle: "italic",
                borderLeft: "2px solid rgba(168,85,247,0.35)",
                paddingLeft: 10,
              }}
            >
              {card.flavor_text}
            </p>
          )}

          {/* CTA */}
          <div style={{ marginTop: 18 }}>
            <Link
              href="/home"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 20px",
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                border: "1px solid rgba(123,79,212,0.6)",
                color: "#fff",
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                boxShadow: "0 4px 16px rgba(123,79,212,0.35)",
              }}
            >
              Chat with card
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Small helper: meta key/value row ─────────────────────────────────────────
function MetaRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--mv-panel-text-muted)",
          flexShrink: 0,
          minWidth: 76,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: highlight ? 700 : 500,
          color: highlight
            ? "#c084fc"
            : "var(--color-text-primary)",
          fontFamily: highlight ? "ui-monospace, monospace" : "inherit",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Ghost card row ────────────────────────────────────────────────────────────
function GhostCard({
  card,
  isLast,
}: {
  card: TimelineCard;
  isLast: boolean;
}) {
  const displayName = card.card_title ?? card.nickname;
  const snap = card.car_snapshot;

  return (
    <div style={{ position: "relative", display: "flex", gap: 0 }}>
      {/* Timeline track */}
      <div
        style={{
          position: "relative",
          width: 32,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
        aria-hidden="true"
      >
        {/* Node dot */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "rgba(168,85,247,0.25)",
            border: "1.5px solid rgba(168,85,247,0.4)",
            flexShrink: 0,
            marginTop: 20,
            zIndex: 1,
          }}
        />
        {/* Connector line */}
        {!isLast && (
          <div
            style={{
              flex: 1,
              width: 1.5,
              background:
                "linear-gradient(to bottom, rgba(168,85,247,0.3), rgba(168,85,247,0.06))",
              marginTop: 4,
            }}
          />
        )}
      </div>

      {/* Card content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          marginBottom: isLast ? 0 : 16,
          paddingBottom: isLast ? 0 : 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: 16,
            borderRadius: 14,
            background: "var(--color-bg-card)",
            border: "1px solid rgba(168,85,247,0.15)",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          {/* Grayscale image */}
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                width: 120,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid rgba(168,85,247,0.12)",
              }}
            >
              <Image
                src={card.pixel_card_url}
                alt={`Ghost card: ${displayName}`}
                width={120}
                height={168}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  filter: "grayscale(0.8) opacity(0.6)",
                }}
              />
            </div>
          </div>

          {/* Details */}
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
            {/* Name + skull */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  color: "rgba(168,85,247,0.5)",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <SkullIcon size={13} />
              </span>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.04em",
                  color: "rgba(200,180,240,0.6)",
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </h3>
            </div>

            {/* Chips */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 5,
                marginBottom: 10,
              }}
            >
              <PersonalityChip personality={card.personality} muted />
              <RarityChip rarity={card.rarity} />
              <EraChip era={card.era} />
              <LevelBadge level={card.card_level} muted />
            </div>

            {/* Meta */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "4px 16px",
                marginBottom: 10,
              }}
            >
              <GhostMeta label="Car" value={carLabel(snap)} />
              {card.occasion && (
                <GhostMeta label="Occasion" value={card.occasion} />
              )}
              <GhostMeta label="Born" value={fmtDate(card.minted_at)} />
              <GhostMeta label="Burned" value={fmtDate(card.burned_at)} />
              {card.hp != null && (
                <GhostMeta label="HP" value={`${card.hp} hp`} />
              )}
              {card.mod_count != null && card.mod_count > 0 && (
                <GhostMeta
                  label="Mods"
                  value={`${card.mod_count} installed`}
                />
              )}
              {card.build_archetype && (
                <GhostMeta label="Archetype" value={card.build_archetype} />
              )}
            </div>

            {/* Last words */}
            {card.last_words && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(168,85,247,0.05)",
                  border: "1px solid rgba(168,85,247,0.1)",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(168,85,247,0.45)",
                    marginBottom: 3,
                  }}
                >
                  Last words
                </p>
                <p
                  style={{
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: "rgba(200,180,240,0.5)",
                    fontStyle: "italic",
                  }}
                >
                  &ldquo;{card.last_words}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GhostMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(168,85,247,0.35)",
          flexShrink: 0,
          minWidth: 60,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(200,180,240,0.5)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyTimeline() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        gap: 16,
        textAlign: "center",
      }}
    >
      {/* Clock / scroll icon */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: "rgba(123,79,212,0.08)",
          border: "2px solid rgba(123,79,212,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-hidden="true"
      >
        <svg
          width={28}
          height={28}
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(168,85,247,0.4)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div>
        <p
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            fontWeight: 700,
            color: "rgba(200,180,240,0.5)",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          No cards yet.
        </p>
        <p
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            color: "rgba(160,140,200,0.35)",
            letterSpacing: "0.04em",
            maxWidth: 280,
            lineHeight: 1.6,
          }}
        >
          Your timeline starts with your first mint.
        </p>
      </div>
      <Link
        href="/mint"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 22px",
          borderRadius: 10,
          background: "rgba(123,79,212,0.15)",
          border: "1px solid rgba(123,79,212,0.35)",
          color: "#c084fc",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        Mint your first card
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function TimelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const primaryCarId = await getPrimaryCarId(supabase, user.id);
  if (!primaryCarId) redirect("/garage");

  // select("*") so pre-migration accounts missing personality/last_words/
  // status columns don't fail the whole query.
  const { data: raw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("user_id", user.id)
    .eq("car_id", primaryCarId)
    .order("minted_at", { ascending: true });

  const allCards = ((raw ?? []) as unknown[]) as TimelineCard[];

  const livingCard =
    allCards.find(
      (c) => c.status === "alive" || (!c.status && !c.burned_at)
    ) ?? null;

  // Ghosts: everything that is not the living card, sorted most-recently-burned first
  const ghosts = allCards
    .filter((c) => c !== livingCard)
    .sort((a, b) => {
      const da = a.burned_at ? new Date(a.burned_at).getTime() : new Date(a.minted_at).getTime();
      const db = b.burned_at ? new Date(b.burned_at).getTime() : new Date(b.minted_at).getTime();
      return db - da;
    });

  const hasCards = allCards.length > 0;

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="3xl" className="pt-10 pb-16">
        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            {/* Icon */}
            <div
              style={{
                padding: 10,
                borderRadius: 12,
                background: "rgba(123,79,212,0.12)",
                border: "1px solid rgba(123,79,212,0.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a855f7"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="2" x2="12" y2="22" />
                <polyline points="17 7 12 2 7 7" />
                <circle cx="12" cy="22" r="1" fill="#a855f7" stroke="none" />
                <circle cx="12" cy="2" r="1" fill="#a855f7" stroke="none" />
              </svg>
            </div>
            <div>
              <h1
                className="text-xl font-black tracking-tight text-[var(--color-text-primary)]"
              >
                Card Timeline
              </h1>
              <p
                className="text-xs text-[var(--color-text-muted)] mt-0.5"
              >
                Every card you&apos;ve ever minted, alive or gone.
              </p>
            </div>
          </div>

          {/* Stats bar */}
          {hasCards && (
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              <StatPill
                label="Total minted"
                value={String(allCards.length)}
              />
              {livingCard && <StatPill label="Living" value="1" accent />}
              {ghosts.length > 0 && (
                <StatPill label="Ghosts" value={String(ghosts.length)} />
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {!hasCards ? (
          <EmptyTimeline />
        ) : (
          <>
            {/* Living card */}
            {livingCard && <LivingCard card={livingCard} />}

            {/* Ghost timeline */}
            {ghosts.length > 0 && (
              <section aria-label="Ghost cards">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      color: "rgba(168,85,247,0.45)",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                    aria-hidden="true"
                  >
                    <SkullIcon size={13} />
                  </span>
                  <h2
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "rgba(168,85,247,0.5)",
                    }}
                  >
                    Ghosts ({ghosts.length})
                  </h2>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {ghosts.map((card, i) => (
                    <GhostCard
                      key={card.id}
                      card={card}
                      isLast={i === ghosts.length - 1}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* No ghosts but has a living card */}
            {!livingCard && ghosts.length === 0 && (
              <EmptyTimeline />
            )}
          </>
        )}
      </PageContainer>
    </div>
  );
}

// ── Small stat pill ───────────────────────────────────────────────────────────
function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 8,
        background: accent
          ? "rgba(168,85,247,0.12)"
          : "var(--color-bg-card)",
        border: accent
          ? "1px solid rgba(168,85,247,0.3)"
          : "1px solid var(--color-border)",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          fontFamily: "ui-monospace, monospace",
          color: accent ? "#c084fc" : "var(--color-text-primary)",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
