"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Wrench, Store, User, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Mod } from "@/lib/supabase/types";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface ModCardProps {
  mod: Mod;
}

export function ModCard({ mod }: ModCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${mod.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("mods").delete().eq("id", mod.id);
    router.refresh();
  }

  return (
    <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors"
        aria-expanded={expanded}
      >
        {/* Category dot */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <CategoryBadge category={mod.category} className="text-[10px]" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{mod.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {mod.install_date && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {formatDate(mod.install_date)}
              </span>
            )}
            {mod.is_diy ? (
              <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-muted)]">
                <User size={9} /> DIY
              </span>
            ) : mod.shop_name ? (
              <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-muted)]">
                <Store size={9} /> {mod.shop_name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mod.cost != null && (
            <span className="text-sm font-semibold text-[var(--color-accent-bright)]">
              {formatCurrency(mod.cost)}
            </span>
          )}
          {expanded ? (
            <ChevronUp size={14} className="text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--color-border)] pt-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={mod.status} />
            <CategoryBadge category={mod.category} />
          </div>

          {mod.notes && (
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {mod.notes}
            </p>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {mod.install_date && (
              <>
                <span className="text-[var(--color-text-muted)]">Date</span>
                <span>{formatDate(mod.install_date)}</span>
              </>
            )}
            {mod.cost != null && (
              <>
                <span className="text-[var(--color-text-muted)]">Cost</span>
                <span className="text-[var(--color-accent-bright)] font-medium">
                  {formatCurrency(mod.cost)}
                </span>
              </>
            )}
            <span className="text-[var(--color-text-muted)]">Installer</span>
            <span>{mod.is_diy ? "DIY" : mod.shop_name ?? "—"}</span>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Delete mod"
            >
              <Trash2 size={12} />
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
