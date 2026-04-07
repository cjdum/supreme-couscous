"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { formatDate, formatCurrency, getCategoryColor, getCategoryLabel } from "@/lib/utils";
import type { ModCategory } from "@/lib/supabase/types";

interface TimelineMod {
  id: string;
  name: string;
  category: ModCategory;
  cost: number | null;
  install_date: string | null;
  created_at: string;
  shop_name?: string | null;
  is_diy?: boolean;
  notes?: string | null;
}

interface BuildTimelineProps {
  mods: TimelineMod[];
}

/**
 * Horizontal scroll timeline of build mods.
 * Each mod is a node on a line. Click a node to expand its details.
 */
export function BuildTimeline({ mods }: BuildTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Sort by date ascending (oldest first → left to right)
  const sorted = [...mods]
    .filter((m) => m.install_date || m.created_at)
    .sort((a, b) => {
      const dateA = new Date(a.install_date ?? a.created_at).getTime();
      const dateB = new Date(b.install_date ?? b.created_at).getTime();
      return dateA - dateB;
    });

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [sorted.length]);

  function scrollBy(dir: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 360, behavior: "smooth" });
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] py-10 text-center">
        <Calendar size={20} className="mx-auto text-[var(--color-text-disabled)] mb-2" />
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">No timeline yet</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Log mods with install dates to build your timeline</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Scroll arrows (desktop) */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] items-center justify-center hover:bg-[var(--color-bg-elevated)] transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] items-center justify-center hover:bg-[var(--color-bg-elevated)] transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Timeline scroll container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto hide-scrollbar md:px-12"
        style={{ scrollSnapType: "x mandatory" }}
      >
        <div className="relative inline-flex items-start gap-8 pt-3 pb-2 px-2 min-w-full">
          {/* The line */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-[var(--color-border)]"
            style={{ top: "30px" }}
            aria-hidden="true"
          />

          {sorted.map((mod, i) => {
            const color = getCategoryColor(mod.category);
            const date = mod.install_date ?? mod.created_at;
            const isExpanded = expanded === mod.id;

            return (
              <div
                key={mod.id}
                className="relative flex-shrink-0"
                style={{ scrollSnapAlign: "start", width: isExpanded ? "260px" : "120px", transition: "width 250ms ease" }}
              >
                {/* Date label above */}
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider text-center mb-2">
                  {new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(date))}
                </p>

                {/* Node */}
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : mod.id)}
                  className="relative z-10 mx-auto flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "999px",
                    backgroundColor: color,
                    boxShadow: `0 0 0 4px var(--color-bg), 0 0 16px ${color}66`,
                    margin: "0 auto",
                    display: "block",
                  }}
                  aria-label={`Mod: ${mod.name}`}
                  aria-expanded={isExpanded}
                />

                {/* Number badge */}
                <p className="text-[9px] text-center text-[var(--color-text-muted)] font-mono mt-1.5">#{i + 1}</p>

                {/* Card */}
                <div
                  className={`mt-2 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3 transition-all ${
                    isExpanded ? "scale-100 opacity-100" : "scale-95 opacity-80"
                  }`}
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <p className="text-xs font-bold text-white leading-snug line-clamp-2" title={mod.name}>
                    {mod.name}
                  </p>
                  <p className="text-[10px] mt-1 font-semibold uppercase tracking-wider" style={{ color }}>
                    {getCategoryLabel(mod.category)}
                  </p>
                  {mod.cost != null && (
                    <p className="text-[11px] font-bold text-[var(--color-accent-bright)] mt-1.5">
                      {formatCurrency(mod.cost)}
                    </p>
                  )}

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-[var(--color-border)] space-y-1.5 animate-in-fast">
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {formatDate(date)}
                      </p>
                      {mod.is_diy && (
                        <p className="text-[10px] text-[var(--color-text-secondary)] font-medium">DIY install</p>
                      )}
                      {!mod.is_diy && mod.shop_name && (
                        <p className="text-[10px] text-[var(--color-text-secondary)]">@ {mod.shop_name}</p>
                      )}
                      {mod.notes && (
                        <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">
                          {mod.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
