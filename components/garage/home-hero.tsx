"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  MessageSquare,
  Loader2,
  Flame,
} from "lucide-react";
import { TradingCard } from "./trading-card";
import { CardViewerModal } from "./card-viewer-modal";
import { safeEra, ERA_COLORS } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

// ── Types ─────────────────────────────────────────────────────────────────────

type FullCard = MintedCard & {
  card_title?: string | null;
  personality?: string | null;
  card_level?: number | null;
  build_archetype?: string | null;
  status?: string | null;
};

interface HomeHeroProps {
  card: MintedCard;
  carLabel: string;
  carMake: string;
  carModel: string;
  carYear: number;
  username: string;
  totalCards: number;
  installedModCount: number;
  wishlistCount: number;
  totalInvested: number;
  wishlistCost: number;
  biggestModName: string | null;
  biggestModCost: number | null;
  latestModName: string | null;
  daysSinceMint: number | null;
  previousCardFlavourText?: string | null;
}

// ── Main HomeHero ─────────────────────────────────────────────────────────────

export function HomeHero({
  card,
  carLabel,
  carMake,
  carModel,
  carYear,
  username,
  totalCards,
  installedModCount,
  wishlistCount,
  totalInvested,
  wishlistCost,
  biggestModName,
  biggestModCost,
  latestModName,
  previousCardFlavourText,
}: HomeHeroProps) {
  const detail = card as FullCard;
  const cardTitle = detail.card_title ?? detail.nickname;
  const snap = detail.car_snapshot;
  const personality = detail.personality;
  const era = safeEra(card.era);
  const eraStyle = ERA_COLORS[era];

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);

  // ── Speech bubble state ─────────────────────────────────────────────────────
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const [pokeLoading, setPokeLoading] = useState(false);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wiggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spontaneousTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBubble = useCallback((text: string, duration = 10_000) => {
    if (!text.trim()) return;
    setBubble(text.trim());
    setBubbleVisible(true);
    setWiggle(true);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    if (wiggleTimerRef.current) clearTimeout(wiggleTimerRef.current);
    wiggleTimerRef.current = setTimeout(() => setWiggle(false), 1600);
    bubbleTimerRef.current = setTimeout(() => setBubbleVisible(false), duration);
  }, []);

  const fetchLine = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/card-poke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.id }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.line?.trim()) return null;
      return json.line.trim();
    } catch {
      return null;
    }
  }, [card.id]);

  const poke = useCallback(async () => {
    if (pokeLoading) return;
    setPokeLoading(true);
    const line = await fetchLine();
    setPokeLoading(false);
    if (line) showBubble(line);
  }, [fetchLine, showBubble, pokeLoading]);

  // Initial opening line
  useEffect(() => {
    const t = setTimeout(async () => {
      const line = await fetchLine();
      if (line) showBubble(line);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  // Spontaneous bubbles every 45–90s
  useEffect(() => {
    let cancelled = false;
    function schedule() {
      if (spontaneousTimerRef.current) clearTimeout(spontaneousTimerRef.current);
      const delay = 45_000 + Math.random() * 45_000;
      spontaneousTimerRef.current = setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === "visible") {
          const line = await fetchLine();
          if (line && !cancelled) showBubble(line);
        }
        schedule();
      }, delay);
    }
    schedule();
    return () => {
      cancelled = true;
      if (spontaneousTimerRef.current) clearTimeout(spontaneousTimerRef.current);
    };
  }, [fetchLine, showBubble]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      if (wiggleTimerRef.current) clearTimeout(wiggleTimerRef.current);
      if (spontaneousTimerRef.current) clearTimeout(spontaneousTimerRef.current);
    };
  }, []);

  function handleCardClick() { setModalOpen(true); }

  // ── Computed ────────────────────────────────────────────────────────────────
  const mintDate = (() => {
    try {
      return new Date(detail.minted_at).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      });
    } catch { return null; }
  })();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative z-10 min-h-dvh">
      <style>{`
        @keyframes hhBubblePop {
          0%   { opacity: 0; transform: translateY(-4px) scale(0.96); }
          60%  { opacity: 1; transform: translateY(0) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hhFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hhDotBounce {
          0%, 80%, 100% { transform: translateY(0);   opacity: 0.5; }
          40%            { transform: translateY(-5px); opacity: 1;   }
        }
        .hh-layout {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: hhFadeUp 400ms cubic-bezier(0.16,1,0.3,1) both;
        }
        .hh-cols {
          display: flex;
          flex-direction: column;
          gap: 24px;
          align-items: flex-start;
        }
        @media (min-width: 680px) {
          .hh-cols { flex-direction: row; }
        }
        .hh-left {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
          width: 280px;
        }
        @media (max-width: 679px) {
          .hh-left { width: 100%; align-items: center; }
        }
        .hh-right {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        @media (prefers-reduced-motion: reduce) {
          .hh-layout { animation: none; }
        }
      `}</style>

      <div className="hh-layout">

        {/* ── Vault label ────────────────────────────────────────────── */}
        <p style={{
          textAlign: "center",
          margin: 0,
          fontSize: 10,
          color: "var(--text-dim)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}>
          {username}&apos;s vault · {totalCards} {totalCards === 1 ? "card" : "cards"}
        </p>

        {/* ── Last words panel ──────────────────────────────��─────────── */}
        {previousCardFlavourText && (
          <div style={{
            padding: "12px 16px",
            background: "var(--bg-raised)",
            borderLeft: "3px solid var(--era-dawn)",
            borderTop: "1px solid var(--border-card)",
            borderRight: "1px solid var(--border-card)",
            borderBottom: "1px solid var(--border-card)",
          }}>
            <p style={{ margin: 0, fontSize: 12, fontStyle: "italic", color: "var(--text-primary)", lineHeight: 1.55 }}>
              &ldquo;{previousCardFlavourText}&rdquo;
            </p>
            <p style={{ margin: "5px 0 0", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              — last words
            </p>
          </div>
        )}

        {/* ── Two columns ──────────────────────────────────────��──────── */}
        <div className="hh-cols">

          {/* LEFT: Card + bubble + CTA ─────────────────────────────── */}
          <section className="hh-left">

            {/* Speech bubble */}
            <div
              aria-live="polite"
              style={{
                width: "100%",
                minHeight: 58,
                marginBottom: 12,
                pointerEvents: bubbleVisible ? "auto" : "none",
                opacity: bubbleVisible ? 1 : 0,
                transform: bubbleVisible ? "translateY(0)" : "translateY(-6px)",
                transition: "opacity 280ms ease, transform 280ms ease",
              }}
            >
              {bubble && (
                <div style={{
                  position: "relative",
                  background: "var(--bg-raised)",
                  borderLeft: "3px solid var(--era-dawn)",
                  borderTop: "1px solid var(--border-card)",
                  borderRight: "1px solid var(--border-card)",
                  borderBottom: "1px solid var(--border-card)",
                  padding: "10px 14px 12px",
                  animation: bubbleVisible ? "hhBubblePop 320ms cubic-bezier(0.34,1.56,0.64,1)" : "none",
                }}>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "var(--text-primary)", fontStyle: "italic" }}>
                    {bubble}
                  </p>
                  {personality && (
                    <p style={{ margin: "5px 0 0", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      — {personality}
                    </p>
                  )}
                  {/* Caret */}
                  <div aria-hidden style={{
                    position: "absolute",
                    bottom: -7,
                    left: "50%",
                    transform: "translateX(-50%) rotate(45deg)",
                    width: 12,
                    height: 12,
                    background: "var(--bg-raised)",
                    borderRight: "1px solid var(--border-card)",
                    borderBottom: "1px solid var(--border-card)",
                  }} />
                </div>
              )}
            </div>

            {/* Card */}
            <button
              onClick={handleCardClick}
              aria-label={`Open ${cardTitle} card`}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block" }}
            >
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
                rarity={card.rarity}
                flavorText={card.flavor_text}
                occasion={card.occasion}
                mods={snap.mods ?? []}
                modsDetail={snap.mods_detail}
                torque={snap.torque ?? null}
                zeroToSixty={snap.zero_to_sixty ?? null}
                totalInvested={snap.total_invested ?? null}
                personality={personality}
                cardLevel={detail.card_level}
                carLabel={carLabel}
                idle={!wiggle}
                wiggle={wiggle}
                interactive
              />
            </button>

            {/* POKE + TALK buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, width: "100%" }}>
              <button
                type="button"
                className="mv-btn mv-btn-ghost"
                onClick={poke}
                disabled={pokeLoading}
                style={{ flex: 1, opacity: pokeLoading ? 0.6 : 1, cursor: pokeLoading ? "wait" : "pointer" }}
              >
                {pokeLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {pokeLoading ? "Poking..." : "Poke"}
              </button>
              <Link
                href="/talk"
                className="mv-btn mv-btn-primary"
                style={{ flex: 1, textDecoration: "none" }}
              >
                <MessageSquare size={11} />
                Talk to it
              </Link>
            </div>
          </section>

          {/* RIGHT: Info panel ──────────────────────────────────────── */}
          <aside className="hh-right">

            {/* Card identity panel */}
            <div style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border-card)",
              padding: "16px 18px",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Your living card
              </p>
              <h1 style={{
                margin: "0 0 10px",
                fontSize: 24,
                color: "var(--text-accent)",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
                textShadow: "0 1px 0 rgba(0,0,0,0.8), 0 -1px 0 rgba(255,215,0,0.1)",
              }}>
                {cardTitle}
              </h1>

              {/* Badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                {personality && (
                  <EraPill bg="rgba(124,58,237,0.2)" border="rgba(124,58,237,0.6)" color="#7C3AED" label={personality} />
                )}
                <EraPill bg={eraStyle.bg} border={eraStyle.border} color={eraStyle.text} label={era} />
                <EraPill bg="rgba(107,114,128,0.2)" border="rgba(107,114,128,0.5)" color="#9CA3AF" label={card.rarity ?? "Common"} />
              </div>

              {/* 2×2 stats grid: POWER / BUILD / REP / BORN */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, border: "1px solid var(--border-card)", marginBottom: 12 }}>
                <StatBox label="Power" value={card.hp != null ? String(card.hp) : "—"} />
                <StatBox label="Build" value={snap.build_score != null ? String(snap.build_score) : "—"} />
                <StatBox label="Rep" value={card.mod_count != null ? String(card.mod_count) : "—"} />
                <StatBox label="Born" value={mintDate ?? "—"} small />
              </div>

              {/* Flavor text */}
              {card.flavor_text && (
                <div style={{
                  padding: "10px 12px",
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--border-card)",
                }}>
                  <p style={{ margin: 0, fontSize: 11, fontStyle: "italic", color: "var(--text-dim)", lineHeight: 1.55 }}>
                    &ldquo;{card.flavor_text}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Build panel */}
            <div style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              padding: "14px 16px",
            }}>
              <p style={{ margin: "0 0 8px", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                The build
              </p>
              <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {carYear} {carMake} {carModel}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <BuildLine label="Biggest mod" value={biggestModName} extra={biggestModCost != null ? `$${biggestModCost.toLocaleString()}` : null} />
                <BuildLine label="Latest add" value={latestModName} />
                <BuildLine label="Installed" value={String(installedModCount)} />
                <BuildLine label="Wishlist" value={`${wishlistCount}${wishlistCost > 0 ? ` · $${(wishlistCost / 1000).toFixed(1)}k` : ""}`} />
              </div>
            </div>

            {/* Remint */}
            <Link
              href="/mint"
              className="mv-btn mv-btn-danger"
              style={{ width: "100%", boxSizing: "border-box" }}
            >
              <Flame size={11} /> Remint
            </Link>

            {/* Quick links */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Link href="/garage" className="mv-btn mv-btn-ghost" style={{ textDecoration: "none" }}>
                Garage
              </Link>
              <Link href="/community" className="mv-btn mv-btn-ghost" style={{ textDecoration: "none" }}>
                Community
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Card modal ────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <CardViewerModal
          cards={[card]}
          carLabel={carLabel}
          startIndex={0}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EraPill({
  bg,
  border,
  color,
  label,
}: {
  bg: string;
  border: string;
  color: string;
  label: string;
}) {
  return (
    <span style={{
      fontSize: 9,
      padding: "3px 10px",
      background: bg,
      border: `1px solid ${border}`,
      color,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    }}>
      {label}
    </span>
  );
}

function StatBox({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "8px 6px",
      background: "var(--bg-sunken)",
      gap: 2,
    }}>
      <span style={{
        fontSize: 8,
        color: "var(--text-dim)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: small ? 11 : 16,
        color: "var(--text-primary)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}>
        {value}
      </span>
    </div>
  );
}

function BuildLine({
  label,
  value,
  extra,
}: {
  label: string;
  value: string | null;
  extra?: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <p style={{
        margin: 0,
        fontSize: 8,
        color: "var(--text-dim)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}>
        {label}
      </p>
      <p style={{
        margin: 0,
        fontSize: 11,
        color: value ? "var(--text-primary)" : "var(--text-dim)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {value ?? "—"}
        {extra && (
          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-dim)" }}>{extra}</span>
        )}
      </p>
    </div>
  );
}
