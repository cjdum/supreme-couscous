"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Zap, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import type { ModCategory } from "@/lib/supabase/types";

interface Suggestion {
  name: string;
  category: ModCategory;
  reason: string;
  estimatedCost: string;
  brands?: string[];
  difficulty?: "bolt-on" | "moderate" | "advanced" | "professional";
  hp_gain?: string | null;
}

interface AiSuggestionsProps {
  carId: string;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  "bolt-on": "var(--color-success)",
  moderate: "var(--color-warning)",
  advanced: "var(--color-danger)",
  professional: "#bf5af2",
};

export function AiSuggestions({ carId }: AiSuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function handleFetch() {
    if (suggestions.length > 0) {
      setOpen((v) => !v);
      return;
    }

    setOpen(true);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: carId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load suggestions");

      setSuggestions(json.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-[18px] overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(10,132,255,0.08) 0%, rgba(10,132,255,0.04) 100%)",
        border: "1px solid rgba(10,132,255,0.2)",
      }}
    >
      {/* Header button */}
      <button
        onClick={handleFetch}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[rgba(10,132,255,0.06)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm">
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">What should I do next?</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              AI-ranked suggestions for your build
            </p>
          </div>
        </div>
        {loading ? (
          <svg className="animate-spin h-4 w-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : open ? (
          <ChevronUp size={15} className="text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown size={15} className="text-[var(--color-text-muted)]" />
        )}
      </button>

      {/* Content */}
      {open && (
        <div className="border-t border-[rgba(10,132,255,0.12)]">
          {loading && (
            <div className="px-5 py-8 text-center space-y-3">
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
                    style={{ animation: `typing-dot 1.2s ease ${i * 0.15}s infinite` }}
                  />
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">Claude is analyzing your build…</p>
            </div>
          )}

          {error && (
            <div className="px-5 py-4">
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => { setSuggestions([]); setError(null); setLoading(false); setOpen(false); }}
              >
                Try again
              </Button>
            </div>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <div>
              {suggestions.slice(0, 5).map((s, i) => (
                <div key={i} className="border-b border-[rgba(10,132,255,0.08)] last:border-0">
                  <button
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    className="w-full text-left px-5 py-3.5 cursor-pointer hover:bg-[rgba(10,132,255,0.04)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-bg-card)] text-[10px] font-bold flex items-center justify-center text-[var(--color-text-muted)] mt-0.5">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{s.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <CategoryBadge category={s.category} className="text-[10px]" />
                            {s.estimatedCost && (
                              <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                                {s.estimatedCost}
                              </span>
                            )}
                            {s.hp_gain && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
                                <Zap size={9} />{s.hp_gain}
                              </span>
                            )}
                            {s.difficulty && (
                              <span
                                className="text-[10px] font-medium"
                                style={{ color: DIFFICULTY_COLOR[s.difficulty] }}
                              >
                                {s.difficulty}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {expanded === i ? (
                        <ChevronUp size={13} className="text-[var(--color-text-muted)] shrink-0 mt-1" />
                      ) : (
                        <ChevronDown size={13} className="text-[var(--color-text-muted)] shrink-0 mt-1" />
                      )}
                    </div>
                  </button>

                  {expanded === i && (
                    <div className="px-5 pb-4 ml-8 space-y-3 animate-in-fast">
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        {s.reason}
                      </p>

                      {s.brands && s.brands.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Wrench size={10} className="text-[var(--color-text-muted)]" />
                          <span className="text-[10px] text-[var(--color-text-muted)]">Brands:</span>
                          {s.brands.map((brand) => (
                            <span key={brand} className="text-[10px] font-medium bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded">
                              {brand}
                            </span>
                          ))}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
