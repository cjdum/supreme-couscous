"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, ExternalLink, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { CategoryBadge } from "@/components/ui/badge";
import type { Car } from "@/lib/supabase/types";

interface Suggestion {
  name: string;
  category: string;
  reason: string;
  estimatedCost: string;
  searchQuery: string;
}

export default function ShopPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingCars, setLoadingCars] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setCars(data ?? []);
      if (data?.[0]) setSelectedCarId(data[0].id);
      setLoadingCars(false);
    });
  }, []);

  async function fetchSuggestions() {
    if (!selectedCarId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: selectedCarId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to get suggestions");
      setSuggestions(json.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function getAffiliateLink(query: string, store: "amazon" | "revzilla") {
    const encoded = encodeURIComponent(query);
    if (store === "amazon") {
      return `https://www.amazon.com/s?k=${encoded}&tag=modvault-20`;
    }
    return `https://www.revzilla.com/search?query=${encoded}`;
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <ShoppingBag size={18} className="text-[var(--color-accent)]" />
        <h1 className="text-xl font-bold">Parts Shop</h1>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        AI-curated part suggestions based on your car and current mods.
      </p>

      {/* Car selector */}
      <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 mb-6">
        {cars.length > 0 && (
          <div className="mb-4">
            <Select
              label="Select vehicle"
              value={selectedCarId}
              onChange={(e) => { setSelectedCarId(e.target.value); setSuggestions([]); }}
              options={cars.map((c) => ({
                value: c.id,
                label: `${c.year} ${c.make} ${c.model}${c.nickname ? ` — ${c.nickname}` : ""}`,
              }))}
            />
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-[8px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] px-3 py-2.5 text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </div>
        )}

        <Button
          className="w-full"
          onClick={fetchSuggestions}
          loading={loading}
          disabled={!selectedCarId || loadingCars}
        >
          <Sparkles size={14} />
          {suggestions.length ? "Refresh suggestions" : "Get part suggestions"}
        </Button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">
            Recommendations for{" "}
            <span className="text-[var(--color-text-primary)]">
              {cars.find((c) => c.id === selectedCarId)?.make}{" "}
              {cars.find((c) => c.id === selectedCarId)?.model}
            </span>
          </h2>

          {suggestions.map((s, i) => (
            <div
              key={i}
              className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <span className="text-xs font-medium text-[var(--color-warning)] shrink-0">
                  {s.estimatedCost}
                </span>
              </div>

              <CategoryBadge category={s.category as "engine" | "suspension" | "aero" | "interior" | "wheels" | "exhaust" | "electronics" | "other"} />

              <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                {s.reason}
              </p>

              <div className="flex gap-2 mt-3">
                <a
                  href={getAffiliateLink(s.searchQuery, "amazon")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[8px] bg-[#FF9900] text-black text-xs font-semibold hover:bg-[#e68a00] transition-colors"
                >
                  <ExternalLink size={11} />
                  Amazon
                </a>
                <a
                  href={getAffiliateLink(s.searchQuery, "revzilla")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-medium hover:border-[var(--color-border-bright)] transition-colors"
                >
                  <ExternalLink size={11} />
                  RevZilla
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && suggestions.length === 0 && cars.length > 0 && (
        <div className="text-center py-12">
          <ShoppingBag size={32} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-40" />
          <p className="text-sm text-[var(--color-text-muted)]">
            Select a vehicle and get AI-powered part suggestions
          </p>
        </div>
      )}
    </div>
  );
}
