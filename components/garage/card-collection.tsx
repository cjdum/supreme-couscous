"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ChevronLeft, ChevronRight, ChevronDown, Share2 } from "lucide-react";
import { TradingCard } from "./trading-card";
import { CardViewerModal } from "./card-viewer-modal";
import { ERAS, ERA_COLORS, RARITY_COLORS, safeEra, safeRarity, type Era } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

interface CardCollectionProps {
  /** All minted cards for the current user, sorted minted_at desc */
  cards: MintedCard[];
  /** Map of car_id → "YYYY Make Model" label (for cards whose car still exists) */
  carLabels: Record<string, string>;
  /** Hide the "Collection" section header — used on the /cards page which has its own page title */
  hideSectionHeader?: boolean;
  /** The currently alive card id — any card that is NOT this one will render with ghost treatment. Pass null/undefined to rely only on status field. */
  aliveCardId?: string | null;
  /** When true, every card in this collection renders with ghost treatment. Used by the mint page's ghost archive. */
  forceAllGhosts?: boolean;
}

interface ViewState {
  cards: MintedCard[];
  carLabel: string;
  startIndex: number;
}

type SortMode =
  | "newest"
  | "oldest"
  | "number-asc"
  | "number-desc"
  | "hp-desc"
  | "hp-asc"
  | "mods-desc"
  | "mods-asc"
  | "spent-desc"
  | "spent-asc";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest",      label: "Newest first" },
  { value: "oldest",      label: "Oldest first" },
  { value: "number-asc",  label: "Card # — low to high" },
  { value: "number-desc", label: "Card # — high to low" },
  { value: "hp-desc",     label: "Horsepower — high to low" },
  { value: "hp-asc",      label: "Horsepower — low to high" },
  { value: "mods-desc",   label: "Mod count — high to low" },
  { value: "mods-asc",    label: "Mod count — low to high" },
  { value: "spent-desc",  label: "Invested — high to low" },
  { value: "spent-asc",   label: "Invested — low to high" },
];

type EraFilter = "all" | Era;

export function CardCollection({ cards, carLabels, hideSectionHeader = false, aliveCardId = null, forceAllGhosts = false }: CardCollectionProps) {
  const [view, setView] = useState<ViewState | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [eraFilter, setEraFilter] = useState<EraFilter>("all");

  const sortGroup = useCallback(
    (group: MintedCard[]): MintedCard[] => {
      const copy = [...group];
      const num  = (v: number | null | undefined, fallback: number) => (v == null ? fallback : v);
      switch (sortMode) {
        case "newest":
          return copy.sort((a, b) => new Date(b.minted_at).getTime() - new Date(a.minted_at).getTime());
        case "oldest":
          return copy.sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
        case "number-asc":
          return copy.sort((a, b) => num(a.card_number, Infinity) - num(b.card_number, Infinity));
        case "number-desc":
          return copy.sort((a, b) => num(b.card_number, -Infinity) - num(a.card_number, -Infinity));
        case "hp-desc":
          return copy.sort((a, b) => num(b.hp, -Infinity) - num(a.hp, -Infinity));
        case "hp-asc":
          return copy.sort((a, b) => num(a.hp, Infinity) - num(b.hp, Infinity));
        case "mods-desc":
          return copy.sort((a, b) => num(b.mod_count, -Infinity) - num(a.mod_count, -Infinity));
        case "mods-asc":
          return copy.sort((a, b) => num(a.mod_count, Infinity) - num(b.mod_count, Infinity));
        case "spent-desc":
          return copy.sort(
            (a, b) => num(b.car_snapshot?.total_invested, -Infinity) - num(a.car_snapshot?.total_invested, -Infinity),
          );
        case "spent-asc":
          return copy.sort(
            (a, b) => num(a.car_snapshot?.total_invested, Infinity) - num(b.car_snapshot?.total_invested, Infinity),
          );
      }
    },
    [sortMode],
  );

  // Apply era filter up-front so every downstream list (groups, counts, keyboard nav) stays consistent.
  const visibleCards = useMemo(
    () => (eraFilter === "all" ? cards : cards.filter((c) => safeEra(c.era) === eraFilter)),
    [cards, eraFilter],
  );

  // Per-era counts for the filter chips
  const eraCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cards) {
      const e = safeEra(c.era);
      m[e] = (m[e] ?? 0) + 1;
    }
    return m;
  }, [cards]);
  // Refs for each car's scroll container (keyed by car key)
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Refs for each focusable card button (keyed by card.id) — used for keyboard focus ring + scroll-into-view
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // Currently "selected" card for keyboard navigation
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Track whether the user has actually interacted with the list. Until they do,
  // focus changes must NOT trigger scrollIntoView — otherwise pages like /mint
  // jump to the ghost archive on mount.
  const userInteractedRef = useRef(false);

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

  // Group visible cards by car_id
  const { groups, carOrder } = useMemo(() => {
    const map = new Map<string, MintedCard[]>();
    for (const c of visibleCards) {
      const key = c.car_id ?? `orphan:${c.id}`;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    const carOrder: string[] = [];
    for (const key of map.keys()) carOrder.push(key);
    return { groups: map, carOrder };
  }, [visibleCards]);

  // Edition lookup: card.id → edition number within its FULL car group (independent of filters).
  // Uses the unfiltered `cards` prop so edition numbers stay stable when the user filters by era.
  const editionOf = useMemo(() => {
    const m = new Map<string, number>();
    const full = new Map<string, MintedCard[]>();
    for (const c of cards) {
      const key = c.car_id ?? `orphan:${c.id}`;
      const arr = full.get(key) ?? [];
      arr.push(c);
      full.set(key, arr);
    }
    for (const arr of full.values()) {
      const sorted = [...arr].sort((a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime());
      sorted.forEach((c, i) => m.set(c.id, i + 1));
    }
    return m;
  }, [cards]);

  // Build ordered flat list of displayed card ids (same order we render below)
  // Display order honors the selected sortMode.
  const flatIds = useMemo(() => {
    const ids: string[] = [];
    for (const key of carOrder) {
      const group = groups.get(key) ?? [];
      for (const c of sortGroup(group)) ids.push(c.id);
    }
    return ids;
  }, [carOrder, groups, sortGroup]);

  // Keep flatOrderRef in sync (used for any outside handlers)
  flatOrderRef.current = flatIds;

  // Repair focused card only if it was removed (filter/sort change). Never
  // force-select on mount — that would trigger scrollIntoView and make the
  // page jump to wherever the first card is sitting.
  useEffect(() => {
    if (focusedId && !flatIds.includes(focusedId) && flatIds.length > 0) {
      setFocusedId(flatIds[0]);
    }
  }, [flatIds, focusedId]);

  // Scroll focused card into view — but ONLY after the user has actually
  // interacted (keyboard nav, click, hover). This prevents the mint page
  // from auto-scrolling to the ghost archive on mount.
  useEffect(() => {
    if (!focusedId || !userInteractedRef.current) return;
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
        userInteractedRef.current = true;
        const next = flatOrderRef.current[Math.min(flatOrderRef.current.length - 1, Math.max(0, idx + 1))];
        if (next) setFocusedId(next);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        userInteractedRef.current = true;
        const prev = flatOrderRef.current[Math.max(0, idx - 1)];
        if (prev) setFocusedId(prev);
      } else if (e.key === "Enter" || e.key === " ") {
        if (focusedId) {
          e.preventDefault();
          userInteractedRef.current = true;
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
    // Always show cards oldest-first in the viewer so edition #1 = first minted.
    const sorted = [...group].sort(
      (a, b) => new Date(a.minted_at).getTime() - new Date(b.minted_at).getTime()
    );
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

        {/* ── Toolbar: era filter chips + sort dropdown ────────────── */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          {/* Era filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setEraFilter("all")}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                background: eraFilter === "all" ? "rgba(168,85,247,0.2)" : "var(--mv-panel-bg)",
                border: `1px solid ${eraFilter === "all" ? "rgba(168,85,247,0.55)" : "rgba(168,85,247,0.15)"}`,
                color: eraFilter === "all" ? "var(--mv-accent-text)" : "var(--mv-panel-text-muted)",
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              All · {cards.length}
            </button>
            {ERAS.map((era) => {
              const count = eraCounts[era] ?? 0;
              if (count === 0) return null;
              const active = eraFilter === era;
              const style = ERA_COLORS[era];
              return (
                <button
                  key={era}
                  onClick={() => setEraFilter(active ? "all" : era)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    background: active ? style.bg : "var(--mv-panel-bg)",
                    border: `1px solid ${active ? style.border : "rgba(168,85,247,0.15)"}`,
                    color: active ? style.text : "var(--mv-panel-text-muted)",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    boxShadow: active ? `0 0 14px ${style.glow}` : "none",
                    transition: "all 150ms ease",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: style.text }} />
                  {era} · {count}
                </button>
              );
            })}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-3 flex-wrap">
          <div
            className="flex items-center gap-2"
            style={{ fontFamily: "ui-monospace, monospace" }}
          >
            <label
              htmlFor="cc-sort"
              style={{
                fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                color: "var(--mv-panel-text-muted)", fontWeight: 800,
              }}
            >
              Sort by
            </label>
            <div
              className="relative"
              style={{
                background: "var(--mv-panel-bg-solid)",
                border: "1px solid var(--mv-panel-border-bright)",
                borderRadius: 10,
                boxShadow: "0 0 14px rgba(168,85,247,0.12)",
              }}
            >
              <select
                id="cc-sort"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                style={{
                  appearance: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  background: "transparent",
                  border: "none",
                  color: "var(--mv-accent-text)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "8px 36px 8px 14px",
                  cursor: "pointer",
                  outline: "none",
                  minWidth: 220,
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} style={{ background: "#13072b", color: "var(--mv-accent-text)" }}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  color: "rgba(200,180,240,0.7)", pointerEvents: "none",
                }}
              />
            </div>
          </div>
          </div>
        </div>

        {/* Showing count */}
        {eraFilter !== "all" && (
          <p
            className="mb-5"
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              color: "rgba(200,180,240,0.5)",
              letterSpacing: "0.08em",
            }}
          >
            Showing {visibleCards.length} of {cards.length} cards
          </p>
        )}

        {visibleCards.length === 0 && (
          <div
            style={{
              textAlign: "center", padding: "60px 20px",
              fontFamily: "ui-monospace, monospace", fontSize: 11,
              color: "rgba(200,180,240,0.4)", letterSpacing: "0.1em",
            }}
          >
            No cards match this filter.
          </div>
        )}

        {/* ── Cards grouped by car, each with a section header ─────────── */}
        <style>{`
          .cc-scroll { scrollbar-width: none; }
          .cc-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {carOrder.map((key) => {
            const group = groups.get(key)!;
            // Display order honors the selected sortMode
            const displayGroup = sortGroup(group);
            // Sample newest card for the header label
            const sample = [...group].sort(
              (a, b) => new Date(b.minted_at).getTime() - new Date(a.minted_at).getTime(),
            )[0];
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

                {/* Cards horizontal scroll for this car.
                    NOTE: overflow-x: auto implicitly clips overflow-y in most
                    browsers, which would crop the focus ring + glow. We add
                    generous vertical padding so the ring renders entirely
                    inside the scroll viewport. */}
                <div
                  ref={setScrollRef(key)}
                  className="cc-scroll"
                  onWheel={(e) => {
                    // Only hijack the wheel event if the user is UNAMBIGUOUSLY
                    // scrolling horizontally. Require deltaX to be at least
                    // double deltaY AND above a small floor, so vertical page
                    // scroll is never intercepted by a stray trackpad nudge.
                    const dx = Math.abs(e.deltaX);
                    const dy = Math.abs(e.deltaY);
                    if (dx > 20 && dx > dy * 2) {
                      e.preventDefault();
                      const el = scrollRefs.current.get(key);
                      if (el) el.scrollLeft += e.deltaX;
                    }
                  }}
                  style={{
                    display: "flex",
                    gap: "1.5rem",
                    overflowX: "auto",
                    overflowY: "hidden",
                    padding: "24px 4px 24px",
                    WebkitOverflowScrolling: "touch",
                    scrollSnapType: "x proximity",
                  }}
                >
                  {displayGroup.map((card) => {
                    const cardSnap = card.car_snapshot;
                    const edition = editionOf.get(card.id) ?? 1;
                    const era = safeEra(card.era);
                    const eraStyle = ERA_COLORS[era];
                    const rarity = safeRarity(card.rarity);
                    const rarityStyle = RARITY_COLORS[rarity];
                    const mintedDate = new Date(card.minted_at).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                    });

                    const isFocused = focusedId === card.id;
                    // Ghost cards get dead visual treatment.
                    // Two sources of truth: explicit status='ghost' (post-migration) OR
                    // "anything that isn't the alive card" (works for pre-migration users).
                    const cardStatus = (card as MintedCard & { status?: string | null }).status;
                    const isGhost =
                      forceAllGhosts ||
                      cardStatus === "ghost" ||
                      (aliveCardId != null && card.id !== aliveCardId);

                    return (
                      <button
                        key={card.id}
                        ref={setCardRef(card.id)}
                        onClick={() => {
                          userInteractedRef.current = true;
                          setFocusedId(card.id);
                          openViewer(card);
                        }}
                        onMouseEnter={() => {
                          userInteractedRef.current = true;
                          setFocusedId(card.id);
                        }}
                        style={{
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          background: "transparent",
                          border: "2px solid",
                          borderColor: isFocused
                            ? (isGhost ? "rgba(220,60,60,0.8)" : "rgba(168,85,247,0.95)")
                            : "transparent",
                          borderRadius: 18,
                          padding: "10px 8px 8px",
                          gap: 6,
                          flexShrink: 0,
                          boxShadow: isFocused
                            ? (isGhost
                              ? "0 0 0 4px rgba(220,60,60,0.15), 0 0 28px rgba(220,60,60,0.3)"
                              : "0 0 0 4px rgba(168,85,247,0.18), 0 0 24px rgba(168,85,247,0.35)")
                            : "none",
                          transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
                          transform: isFocused ? "translateY(-2px)" : "translateY(0)",
                          outline: "none",
                        }}
                      >
                        {/* Card — ghost cards use the new `dead` visual (charred red, no grayscale) */}
                        <div style={{ position: "relative" }}>
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
                            rarity={card.rarity}
                            flavorText={card.flavor_text}
                            occasion={card.occasion}
                            mods={cardSnap.mods ?? []}
                            modsDetail={cardSnap.mods_detail}
                            torque={cardSnap.torque ?? null}
                            zeroToSixty={cardSnap.zero_to_sixty ?? null}
                            totalInvested={cardSnap.total_invested ?? null}
                            edition={totalEditions > 1 ? edition : null}
                            carLabel={carLabel}
                            scale={0.62}
                            idle={false}
                            interactive
                            dead={isGhost}
                          />
                        </div>

                        {/* Era badge + rarity badge + burn badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                          {isGhost && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 3,
                              padding: "3px 8px", borderRadius: 12,
                              background: "rgba(220,38,38,0.18)", border: "1px solid rgba(220,38,38,0.55)",
                              boxShadow: "0 0 10px rgba(220,38,38,0.25)",
                            }}>
                              <span style={{
                                fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 900,
                                letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "#fca5a5",
                              }}>
                                Burned
                              </span>
                            </div>
                          )}
                          <div style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "2px 7px", borderRadius: 12,
                            background: isGhost ? "rgba(180,40,40,0.16)" : eraStyle.bg,
                            border: `1px solid ${isGhost ? "rgba(220,60,60,0.4)" : eraStyle.border}`,
                          }}>
                            <div style={{ width: 4, height: 4, borderRadius: "50%", background: isGhost ? "#fca5a5" : eraStyle.text, flexShrink: 0 }} />
                            <span style={{
                              fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 900,
                              letterSpacing: "0.18em", textTransform: "uppercase" as const,
                              color: isGhost ? "#fca5a5" : eraStyle.text,
                            }}>
                              {era}
                            </span>
                          </div>
                          {!isGhost && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 3,
                              padding: "2px 6px", borderRadius: 12,
                              background: rarityStyle.bg,
                              border: `1px solid ${rarityStyle.border}`,
                              boxShadow: rarity === "Legendary" ? `0 0 8px ${rarityStyle.glow}` : "none",
                            }}>
                              <span style={{
                                fontFamily: "ui-monospace, monospace", fontSize: 7, fontWeight: 900,
                                letterSpacing: "0.12em", textTransform: "uppercase" as const,
                                color: rarityStyle.text,
                              }}>
                                {rarity}
                              </span>
                            </div>
                          )}
                          {card.card_number != null && (
                            <span style={{
                              fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700,
                              color: isGhost ? "rgba(220,150,150,0.55)" : "rgba(200,180,240,0.5)", letterSpacing: "0.1em",
                            }}>
                              #{String(card.card_number).padStart(4, "0")}
                            </span>
                          )}
                        </div>

                        {/* Edition + mint date + occasion + share */}
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
                          {/* Share button — copies /c/[id] to clipboard */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = `${window.location.origin}/c/${card.id}`;
                              navigator.clipboard.writeText(url).catch(() => {});
                            }}
                            title="Copy share link"
                            style={{
                              marginTop: 4,
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "3px 8px", borderRadius: 8,
                              background: "rgba(123,79,212,0.1)", border: "1px solid rgba(123,79,212,0.2)",
                              color: "rgba(200,180,240,0.5)",
                              fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700,
                              letterSpacing: "0.1em", textTransform: "uppercase",
                              cursor: "pointer",
                              transition: "all 150ms ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = "rgba(123,79,212,0.2)";
                              (e.currentTarget as HTMLButtonElement).style.color = "rgba(200,180,240,0.85)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = "rgba(123,79,212,0.1)";
                              (e.currentTarget as HTMLButtonElement).style.color = "rgba(200,180,240,0.5)";
                            }}
                          >
                            <Share2 size={9} />
                            Share
                          </button>
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
