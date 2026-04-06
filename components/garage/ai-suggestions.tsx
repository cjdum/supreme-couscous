"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, DollarSign, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/badge";
import type { ModCategory } from "@/lib/supabase/types";

interface Suggestion {
  name: string;
  category: ModCategory;
  reason: string;
  estimatedCost: string;
  searchQuery: string;
}

interface AiSuggestionsProps {
  carId: string;
}

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
    <div className="rounded-2xl border border-[rgba(59,130,246,0.2)] bg-[var(--color-accent-muted)] overflow-hidden">
      {/* Header button */}
      <button
        onClick={handleFetch}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[rgba(59,130,246,0.08)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm">
            <Sparkles size={14} className="text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">What should I do next?</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              AI-ranked suggestions for your build
            </p>
          </div>
        </div>
        {loading ? (
          <svg
            className="animate-spin h-4 w-4 text-[var(--color-accent)]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : open ? (
          <ChevronUp size={16} className="text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown size={16} className="text-[var(--color-text-muted)]" />
        )}
      </button>

      {/* Content */}
      {open && (
        <div className="border-t border-[rgba(59,130,246,0.15)]">
          {loading && (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">
                Claude is analyzing your build…
              </p>
            </div>
          )}

          {error && (
            <div className="px-5 py-4">
              <p className="text-xs text-[var(--color-danger)]">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSuggestions([]);
                  setError(null);
                  setLoading(false);
                  setOpen(false);
                }}
              >
                Try again
              </Button>
            </div>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <div className="divide-y divide-[rgba(59,130,246,0.1)]">
              {suggestions.slice(0, 5).map((s, i) => (
                <div key={i} className="px-5 py-3.5">
                  <button
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    className="w-full text-left cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-bg-card)] text-[10px] font-bold flex items-center justify-center text-[var(--color-text-muted)] mt-0.5">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{s.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <CategoryBadge category={s.category} className="text-[10px]" />
                            {s.estimatedCost && (
                              <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-muted)]">
                                <DollarSign size={9} />
                                {s.estimatedCost}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {expanded === i ? (
                        <ChevronUp size={14} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown size={14} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>

                  {expanded === i && (
                    <div className="mt-3 ml-8 space-y-2">
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        {s.reason}
                      </p>
                      {s.searchQuery && (
                        <p className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                          <Tag size={9} />
                          Search: <span className="italic">{s.searchQuery}</span>
                        </p>
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
