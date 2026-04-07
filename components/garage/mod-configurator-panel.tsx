"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, CheckCircle2, BookmarkPlus, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, getCategoryLabel, MOD_CATEGORIES } from "@/lib/utils";
import { AddModModal } from "@/components/mods/add-mod-modal";
import type { Mod, ModCategory } from "@/lib/supabase/types";

interface ModConfiguratorPanelProps {
  open: boolean;
  onClose: () => void;
  carId: string;
  carName: string;
  onChanged?: () => void;
}

type CategoryFilter = ModCategory | "all";

export function ModConfiguratorPanel({
  open,
  onClose,
  carId,
  carName,
  onChanged,
}: ModConfiguratorPanelProps) {
  const router = useRouter();
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [addingMod, setAddingMod] = useState(false);

  function openModDetail(mod: Mod) {
    onClose();
    router.push(`/garage/${mod.car_id}#mod-${mod.id}`);
  }

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Fetch mods when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("mods")
        .select("*")
        .eq("car_id", carId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setMods((data ?? []) as Mod[]);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, carId]);

  function refreshMods() {
    const supabase = createClient();
    supabase
      .from("mods")
      .select("*")
      .eq("car_id", carId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setMods((data ?? []) as Mod[]);
      });
    onChanged?.();
  }

  const filtered = activeCategory === "all" ? mods : mods.filter((m) => m.category === activeCategory);
  const installedCount = mods.filter((m) => m.status === "installed").length;
  const wishlistCount = mods.filter((m) => m.status === "wishlist").length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Customize ${carName}`}
        className="fixed top-0 right-0 bottom-0 z-[61] w-full sm:w-[380px] bg-[var(--color-bg-card)] border-l border-[var(--color-border)] shadow-[-24px_0_64px_rgba(0,0,0,0.5)] flex flex-col"
        style={{
          animation: "slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              Your Build
            </p>
            <h2 className="text-base font-bold truncate mt-0.5">{carName}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold">
              <span className="flex items-center gap-1 text-[#30d158]">
                <CheckCircle2 size={10} />
                {installedCount} installed
              </span>
              <span className="flex items-center gap-1 text-[#fbbf24]">
                <BookmarkPlus size={10} />
                {wishlistCount} wishlist
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] transition-colors cursor-pointer flex-shrink-0"
            aria-label="Close panel"
          >
            <X size={15} />
          </button>
        </div>

        {/* Category chips (horizontal scroll) */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-[var(--color-border)] overflow-x-auto hide-scrollbar">
          <div className="flex items-center gap-2 w-max">
            <CategoryChip
              label="All"
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
              count={mods.length}
            />
            {MOD_CATEGORIES.map((cat) => {
              const count = mods.filter((m) => m.category === cat.value).length;
              if (count === 0) return null;
              return (
                <CategoryChip
                  key={cat.value}
                  label={cat.label}
                  color={cat.color}
                  active={activeCategory === cat.value}
                  onClick={() => setActiveCategory(cat.value)}
                  count={count}
                />
              );
            })}
          </div>
        </div>

        {/* Mod list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 skeleton rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-10 text-center">
              <Wrench size={20} className="mx-auto text-[var(--color-text-disabled)] mb-2" />
              <p className="text-xs font-bold text-[var(--color-text-secondary)]">No mods yet</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Tap &ldquo;Add mod&rdquo; below to start
              </p>
            </div>
          ) : (
            filtered.map((mod) => (
              <ModRow key={mod.id} mod={mod} onClick={() => openModDetail(mod)} />
            ))
          )}
        </div>

        {/* Footer — Add mod */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <button
            type="button"
            onClick={() => setAddingMod(true)}
            className="w-full h-12 rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] cursor-pointer shadow-[0_8px_32px_rgba(59,130,246,0.25)]"
          >
            <Plus size={16} />
            Add mod
          </button>
        </div>
      </aside>

      {addingMod && (
        <AddModModal
          open={addingMod}
          onClose={() => {
            setAddingMod(false);
            refreshMods();
          }}
          carId={carId}
        />
      )}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translate3d(100%, 0, 0);
          }
          to {
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  count,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full border whitespace-nowrap transition-all cursor-pointer text-[11px] font-bold ${
        active
          ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-[0_4px_16px_rgba(59,130,246,0.25)]"
          : "bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] hover:text-white"
      }`}
    >
      {color && !active && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      {label}
      <span
        className={`tabular ${active ? "text-white/80" : "text-[var(--color-text-muted)]"}`}
      >
        {count}
      </span>
    </button>
  );
}

function ModRow({ mod, onClick }: { mod: Mod; onClick: () => void }) {
  const installed = mod.status === "installed";
  const statusColor = installed ? "#30d158" : "#fbbf24";
  const StatusIcon = installed ? CheckCircle2 : BookmarkPlus;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-3.5 hover:border-[var(--color-border-bright)] hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white truncate">{mod.name}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${statusColor}1a`,
                color: statusColor,
                border: `1px solid ${statusColor}33`,
              }}
            >
              <StatusIcon size={9} />
              {installed ? "Installed" : "Wishlist"}
            </span>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {getCategoryLabel(mod.category)}
            </span>
          </div>
        </div>
        {mod.cost != null && (
          <p className="text-[11px] font-bold text-[#60A5FA] tabular flex-shrink-0">
            {formatCurrency(mod.cost)}
          </p>
        )}
      </div>
    </button>
  );
}

