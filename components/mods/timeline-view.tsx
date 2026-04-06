"use client";

import { formatDate, getCategoryColor, getCategoryLabel } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { Mod } from "@/lib/supabase/types";

interface TimelineViewProps {
  mods: Pick<Mod, "id" | "name" | "category" | "cost" | "install_date" | "created_at">[];
}

export function TimelineView({ mods }: TimelineViewProps) {
  // Sort by install date (most recent first), fallback to created_at
  const sorted = [...mods]
    .filter((m) => m.install_date || m.created_at)
    .sort((a, b) => {
      const dateA = new Date(a.install_date ?? a.created_at).getTime();
      const dateB = new Date(b.install_date ?? b.created_at).getTime();
      return dateB - dateA;
    });

  return (
    <div className="relative" role="list" aria-label="Build timeline">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[var(--color-border)]" aria-hidden="true" />

      <div className="space-y-4">
        {sorted.map((mod, i) => {
          const color = getCategoryColor(mod.category);
          const date = mod.install_date
            ? formatDate(mod.install_date)
            : formatDate(mod.created_at);

          return (
            <div key={mod.id} className="relative flex gap-4" role="listitem">
              {/* Dot */}
              <div
                className="relative z-10 w-[22px] h-[22px] shrink-0 rounded-full border-2 border-[var(--color-bg-card)] flex items-center justify-center mt-0.5"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{mod.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] font-medium"
                        style={{ color }}
                      >
                        {getCategoryLabel(mod.category)}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {date}
                      </span>
                    </div>
                  </div>
                  {mod.cost != null && (
                    <span className="text-xs font-semibold text-[var(--color-accent-bright)] shrink-0">
                      {formatCurrency(mod.cost)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
