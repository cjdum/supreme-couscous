"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

interface CommunityFiltersProps {
  makes: string[];
  currentMake?: string;
  currentModel?: string;
}

export function CommunityFilters({ makes, currentMake, currentModel }: CommunityFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [make, setMake] = useState(currentMake ?? "");
  const [model, setModel] = useState(currentModel ?? "");

  function applyFilters() {
    const params = new URLSearchParams();
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    router.push(`/community${params.toString() ? `?${params}` : ""}`);
  }

  function clearFilters() {
    setMake("");
    setModel("");
    router.push("/community");
  }

  const hasFilters = currentMake || currentModel;

  return (
    <div className="mb-5 flex items-center gap-2 flex-wrap">
      <select
        value={make}
        onChange={(e) => setMake(e.target.value)}
        className="h-9 rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-3 text-xs text-[var(--color-text-primary)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        aria-label="Filter by make"
      >
        <option value="">All Makes</option>
        {makes.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <input
        type="text"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder="Filter by model…"
        className="h-9 rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-3 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] w-40"
        onKeyDown={(e) => e.key === "Enter" && applyFilters()}
      />

      <button
        onClick={applyFilters}
        className="h-9 px-3 rounded-[8px] bg-[var(--color-accent)] text-white text-xs font-medium flex items-center gap-1.5 hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
      >
        <Search size={12} />
        Search
      </button>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="h-9 px-3 rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5 hover:border-[var(--color-border-bright)] transition-colors cursor-pointer"
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  );
}
