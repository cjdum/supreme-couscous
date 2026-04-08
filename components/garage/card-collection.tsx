"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { TradingCard } from "./trading-card";
import { CardViewerModal } from "./card-viewer-modal";
import { ERA_COLORS, safeEra } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

interface CardCollectionProps {
  /** All minted cards for the current user, sorted minted_at desc */
  cards: MintedCard[];
  /** Map of car_id → "YYYY Make Model" label (for cards whose car still exists) */
  carLabels: Record<string, string>;
  /** Hide the "Collection" section header — used on the /cards page which has its own page title */
  hideSectionHeader?: boolean;
}

interface ViewState {
  cards: MintedCard[];
  carLabel: string;
  startIndex: number;
}

export function CardCollection({ cards, carLabels, hideSectionHeader = false }: CardCollectionProps) {
  const [view, setView] = useState<ViewState | null>(null);
  // Refs for each car's scroll container (keyed by car key)
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Refs for each focusable card button (keyed by card.id) — used for keyboard focus ring + scroll-into-view
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // Currently "selected" card for keyboard navigation
  const [focusedId, setFocusedId] = useState<string | null>(null);

  function setScrollRef(key: string) {
    return (el: HTMLDivElement | null) => {
      if (el) scrollRefs.current.set(key, el);
      else scrollRefs.current.delete(key);
    };
  }

  function setCardRef(id: string) {
    return (el: HTMLButtonElement | null) => {
      if (el) cardRefs.current.set(id, el);
      else cardRefs.current.delete(id);
    };
  }

  // Flat ordered list of all card ids in display order (across all car groups)
  // Populated during render below. Used for keyboard navigation.
  const flatOrderRef = useRef<string[]>([]);

  // Group cards by car_id, maintain a stable car order (first appearance, sorted by oldest mint)
  const { groups, carOrder } = useMemo(() => {
    const map = new Map<string, MintedCard[]>();
    // Collect into groups (cards already sorted desc by minted_at from the server)
    for (const c of cards) {
      const key = c.car_id ?? `orphan:${c.id}`;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    // Within each group, sort oldest → newest for edition numbering, keep display newest→oldest
    const carOrder: string[] = [];
    for (const key of map.keys()) {
      carOrder.push(key);
    }
    // Each group: sort oldest first for edition numbers
    const editionMap = new Map<string, MintedCard[]>();
    for (const [key, arr] of map.entries()) {
      const sorted = [...arr].sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
      editionMap.set(key, sorted);
    }
    return { groups: map, carOrder, editionMap };
  }, [cards]);

  // Edition lookup: card.id → edition number within its car group
  const editionOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const arr of groups.values()) {
      // arr is desc (newest first) — sort oldest first for edition numbering
      const sorted = [...arr].sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
      sorted.forEach((c, i) => m.set(c.id, i + 1));
    }
    return m;
  }, [groups]);

  // Build ordered flat list of displayed card ids (same order we render below)
  // Display order: oldest → newest (left = oldest, right = newest)
  const flatIds = useMemo(() => {
    const ids: string[] = [];
    for (const key of carOrder) {
      const group = groups.get(key) ?? [];
      const displayGroup = [...group].sort(
        (a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime(),
      );
      for (const c of displayGroup) ids.push(c.id);
    }
    return ids;
  }, [carOrder, groups]);

  // Keep flatOrderRef in sync (used for any outside handlers)
  flatOrderRef.current = flatIds;

  // Initialize focused card
  useEffect(() => {
    if (focusedId == null && flatIds.length > 0) setFocusedId(flatIds[0]);
    else if (focusedId && !flatIds.includes(focusedId) && flatIds.length > 0) {
      setFocusedId(flatIds[0]);
    }
  }, [flatIds, focusedId]);

  // Scroll focused card into view horizontally (smooth, block: nearest)
  useEffect(() => {
    if (!focusedId) return;
    const el = cardRefs.current.get(focusedId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [focusedId]);

  // Keyboard navigation (only active when no modal is open)
  useEffect(() => {
    if (view) return; // modal takes over
    function onKey(e: KeyboardEvent) {
      // Ignore if the user is typing into an input/textarea/contenteditable
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!flatOrderRef.current.length) return;
      const idx = focusedId ? flatOrderRef.current.indexOf(focusedId) : -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = flatOrderRef.current[Math.min(flatOrderRef.current.length - 1, Math.max(0, idx + 1))];
        if (next) setFocusedId(next);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = flatOrderRef.current[Math.max(0, idx - 1)];
        if (prev) setFocusedId(prev);
      } else if (e.key === "Enter" || e.key === " ") {
        if (focusedId) {
          e.preventDefault();
          const card = cards.find((c) => c.id === focusedId);
          if (card) openViewer(card);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId, view, cards]);

  if (cards.length === 0) return null;

  function openViewer(card: MintedCard) {
    const key = card.car_id ?? `orphan:${card.id}`;
    const group = groups.get(key) ?? [card];
    // Sort oldest → newest so edition numbers match array index + 1
    const sorted = [...group].sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
    const startIndex = sorted.findIndex((c) => c.id === card.id);
    const label = card.car_id ? carLabels[card.car_id] : null;
    const snap = card.car_snapshot;
    const fallback = `${snap.year} ${snap.make} ${snap.model}`;
    setView({
      cards: sorted,
      carLabel: label ?? fallback,
      startIndex: Math.max(0, startIndex),
    });
  }

  return (
    <>
      {view && (
        <CardViewerModal
          cards={view.cards}
          carLabel={view.carLabel}
          startIndex={view.startIndex}
          onClose={() => setView(null)}
        />
      )}

      <section className={hideSectionHeader ? "" : "mt-14"}>
        {!hideSectionHeader && (
          <div className="flex items-center gap-2 mb-6">
            <Sparkles size={15} className="text-[#f5d76e]" />
            <div>
              <h2 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">Collection</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {cards.length} permanent {cards.length === 1 ? "card" : "cards"} minted
              </p>
            </div>
          </div>
        )}

        {/* ── Cards grouped by car, each with a section header ─────────── */}
        <style>{`
          .cc-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {carOrder.map((key) => {
            const group = groups.get(key)!;
            // Display oldest → newest (left = oldest, right = latest)
            const displayGroup = [...group].sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
            const sample = displayGroup[displayGroup.length - 1];
            const snap = sample.car_snapshot;
            const carLabel = (sample.car_id && carLabels[sample.car_id]) || `${snap.year} ${snap.make} ${snap.model}`;
            const totalEditions = group.length;

            function scrollBy(dir: 1 | -1) {
              const el = scrollRefs.current.get(key);
              if (!el) return;
              el.scrollBy({ left: dir * 200, behavior: "smooth" });
            }

            return (
              <div key={key}>
                {/* Car section header */}
                <div className="flex items-center justify-between pb-2 mb-4 border-b border-[rgba(123,79,212,0.22)]">
                  <div>
                    <h3
                      className="text-[var(--color-text-primary)] m-0"
                      style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}
                    >
                      {carLabel}
                    </h3>
                    <p
                      className="text-[var(--color-text-muted)]"
                      style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, letterSpacing: "0.08em", margin: "2px 0 0" }}
                    >
                      {totalEditions} {totalEditions === 1 ? "card" : "cards"}
                    </p>
                  </div>
                  {/* Arrow controls (only when more than ~2 cards) */}
                  {totalEditions > 2 && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => scrollBy(-1)}
                        aria-label="Scroll left"
                        style={{
                          width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(123,79,212,0.3)",
                          background: "rgba(123,79,212,0.08)", color: "rgba(200,180,240,0.7)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => scrollBy(1)}
                        aria-label="Scroll right"
                        style={{
                          width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(123,79,212,0.3)",
                          background: "rgba(123,79,212,0.08)", color: "rgba(200,180,240,0.7)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Cards horizontal scroll for this car */}
                <div
                  ref={setScrollRef(key)}
                  className="cc-scroll"
                  style={{
                    display: "flex",
                    gap: "1.5rem",
                    overflowX: "auto",
                    paddingBottom: "0.75rem",
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: "none",
                  }}
                >
                  {displayGroup.map((card) => {
                    const cardSnap = card.car_snapshot;
                    const edition = editionOf.get(card.id) ?? 1;
                    const era = safeEra(card.era);
                    const eraStyle = ERA_COLORS[era];
                    const mintedDate = new Date(card.minted_at).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                    });

                    const isFocused = focusedId === card.id;
                    return (
                      <button
                        key={card.id}
                        ref={setCardRef(card.id)}
                        onClick={() => {
                          setFocusedId(card.id);
                          openViewer(card);
                        }}
                        onMouseEnter={() => setFocusedId(card.id)}
                        style={{
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          background: "transparent",
                          border: "2px solid",
                          borderColor: isFocused ? "rgba(168,85,247,0.95)" : "transparent",
                          borderRadius: 18,
                          padding: "10px 8px 8px",
                          gap: 6,
                          flexShrink: 0,
                          boxShadow: isFocused
                            ? "0 0 0 4px rgba(168,85,247,0.18), 0 0 24px rgba(168,85,247,0.35)"
                            : "none",
                          transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
                          transform: isFocused ? "translateY(-2px)" : "translateY(0)",
                          outline: "none",
                        }}
                      >
                        <TradingCard
                          cardUrl={card.pixel_card_url}
                          nickname={card.nickname}
                          generatedAt={card.minted_at}
                          hp={card.hp}
                          modCount={card.mod_count}
                          buildScore={cardSnap.build_score}
                          vinVerified={cardSnap.vin_verified}
                          cardNumber={card.card_number}
                          era={card.era}
                          flavorText={card.flavor_text}
                          occasion={card.occasion}
                          mods={cardSnap.mods ?? []}
                          modsDetail={cardSnap.mods_detail}
                          torque={cardSnap.torque ?? null}
                          zeroToSixty={cardSnap.zero_to_sixty ?? null}
                          totalInvested={cardSnap.total_invested ?? null}
                          edition={totalEditions > 1 ? edition : null}
                          carLabel={carLabel}
                          scale={0.6}
                          idle
                          interactive
                        />

                        {/* Era badge + card# */}
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "2px 7px", borderRadius: 12,
                            background: eraStyle.bg, border: `1px solid ${eraStyle.border}`,
                          }}>
                            <div style={{ width: 4, height: 4, borderRadius: "50%", background: eraStyle.text, flexShrink: 0 }} />
                            <span style={{
                              fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 900,
                              letterSpacing: "0.18em", textTransform: "uppercase" as const, color: eraStyle.text,
                            }}>
                              {era}
                            </span>
                          </div>
                          {card.card_number != null && (
                            <span style={{
                              fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700,
                              color: "rgba(200,180,240,0.5)", letterSpacing: "0.1em",
                            }}>
                              #{String(card.card_number).padStart(4, "0")}
                            </span>
                          )}
                        </div>

                        {/* Edition + mint date + occasion */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                          {totalEditions > 1 && (
                            <p style={{
                              margin: 0,
                              fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800,
                              color: "rgba(245,215,110,0.75)", letterSpacing: "0.15em", textTransform: "uppercase" as const,
                            }}>
                              Ed. {edition} / {totalEditions}
                            </p>
                          )}
                          <p style={{
                            margin: 0,
                            fontFamily: "ui-monospace, monospace", fontSize: 8,
                            color: "rgba(180,160,220,0.45)", letterSpacing: "0.08em",
                          }}>
                            {mintedDate}
                          </p>
                          {card.occasion && (
                            <p style={{
                              margin: "2px 0 0",
                              fontFamily: "ui-monospace, monospace", fontSize: 8, fontStyle: "italic",
                              color: eraStyle.text, letterSpacing: "0.04em",
                              maxWidth: 160, textAlign: "center",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              &ldquo;{card.occasion}&rdquo;
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
