"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Trash2, BookmarkPlus, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Mod, ModStatus } from "@/lib/supabase/types";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { getCategoryColor } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/haptics";

interface ModCardProps {
  mod: Mod;
  onChange?: () => void;
}

const SWIPE_THRESHOLD = 80;
const COMMIT_DISTANCE = 140;

export function ModCard({ mod, onChange }: ModCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [dragX, setDragX] = useState(0);
  const dragStartX = useRef<number | null>(null);

  const accentColor = getCategoryColor(mod.category);
  const otherStatus: ModStatus = mod.status === "installed" ? "wishlist" : "installed";

  // Touch / pointer handlers for swipe
  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, a")) return; // skip if user touches inner button
    dragStartX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    // Clamp
    setDragX(Math.max(-200, Math.min(200, dx)));
  }

  function onPointerUp() {
    if (dragStartX.current === null) return;
    const dx = dragX;
    dragStartX.current = null;

    if (dx <= -COMMIT_DISTANCE) {
      // Swipe left → delete
      handleDelete();
      return;
    }
    if (dx >= COMMIT_DISTANCE) {
      // Swipe right → move to other status
      handleMoveStatus();
      return;
    }
    setDragX(0);
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setDragX(-window.innerWidth); // animate out
    haptic("heavy");
    const supabase = createClient();
    await supabase.from("mods").delete().eq("id", mod.id);
    setTimeout(() => {
      setRemoved(true);
      onChange?.();
      router.refresh();
    }, 300);
  }

  async function handleMoveStatus() {
    if (moving) return;
    setMoving(true);
    setDragX(window.innerWidth);
    haptic("medium");
    const supabase = createClient();
    await supabase.from("mods").update({ status: otherStatus }).eq("id", mod.id);
    setTimeout(() => {
      setRemoved(true);
      onChange?.();
      router.refresh();
    }, 300);
  }

  async function handleDeleteFromMenu() {
    if (!confirm(`Delete "${mod.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    haptic("heavy");
    const supabase = createClient();
    await supabase.from("mods").delete().eq("id", mod.id);
    onChange?.();
    router.refresh();
  }

  // Reset drag if cancelled
  useEffect(() => {
    function onCancel() {
      if (dragStartX.current !== null) {
        dragStartX.current = null;
        setDragX(0);
      }
    }
    window.addEventListener("pointercancel", onCancel);
    return () => window.removeEventListener("pointercancel", onCancel);
  }, []);

  if (removed) return null;

  const showLeftAction = dragX < -8;
  const showRightAction = dragX > 8;
  const leftActionProgress = Math.min(1, Math.abs(dragX) / COMMIT_DISTANCE);

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Background actions revealed by swipe */}
      {showLeftAction && (
        <div className="absolute inset-y-0 right-0 flex items-center justify-end px-6 bg-gradient-to-l from-[var(--color-danger)] to-transparent" style={{ width: `${Math.abs(dragX)}px` }}>
          <div className="flex items-center gap-2 text-white" style={{ opacity: leftActionProgress }}>
            <Trash2 size={18} />
            <span className="text-sm font-bold">Delete</span>
          </div>
        </div>
      )}
      {showRightAction && (
        <div className="absolute inset-y-0 left-0 flex items-center justify-start px-6 bg-gradient-to-r from-[var(--color-warning)] to-transparent" style={{ width: `${Math.abs(dragX)}px` }}>
          <div className="flex items-center gap-2 text-black" style={{ opacity: leftActionProgress }}>
            {mod.status === "installed" ? <BookmarkPlus size={18} /> : <Wrench size={18} />}
            <span className="text-sm font-bold">{mod.status === "installed" ? "Wishlist" : "Installed"}</span>
          </div>
        </div>
      )}

      {/* Card */}
      <div
        className="mod-bar rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden relative touch-pan-y"
        style={{
          // @ts-expect-error custom prop
          "--mod-color": accentColor,
          transform: `translate3d(${dragX}px, 0, 0)`,
          transition: dragStartX.current === null ? "transform 250ms cubic-bezier(0.16, 1, 0.3, 1)" : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Main row */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-3 pl-5 pr-4 py-4 text-left cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          aria-expanded={expanded}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{mod.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <CategoryBadge category={mod.category} className="text-[10px]" />
              <StatusBadge status={mod.status} />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {expanded ? (
              <ChevronUp size={15} className="text-[var(--color-text-muted)]" />
            ) : (
              <ChevronDown size={15} className="text-[var(--color-text-muted)]" />
            )}
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="pl-5 pr-4 pb-4 border-t border-[var(--color-border)] pt-3.5 space-y-3 animate-in-fast">
            {mod.notes ? (
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {mod.notes}
              </p>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] italic">No notes.</p>
            )}

            <div className="flex justify-end items-center gap-2 pt-1">
              <button
                onClick={handleDeleteFromMenu}
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

      {/* Swipe hint (only mobile, only first card) */}
      <p className="sr-only">Swipe left to delete, right to {otherStatus}</p>
    </div>
  );
}
