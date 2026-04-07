"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddCarModal } from "./add-car-modal";

interface AddCarButtonProps {
  label?: string;
  asCard?: boolean;
  fab?: boolean;
}

export function AddCarButton({ label, asCard, fab }: AddCarButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {fab ? (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center shadow-[0_8px_32px_rgba(59,130,246,0.4),0_2px_8px_rgba(0,0,0,0.4)] hover:scale-110 hover:shadow-[0_12px_40px_rgba(59,130,246,0.5)] active:scale-95 transition-all cursor-pointer"
          aria-label="Add car"
        >
          <Plus size={24} />
        </button>
      ) : asCard ? (
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-border-bright)] hover:bg-[var(--color-bg-elevated)] transition-all duration-200 cursor-pointer group"
          style={{ aspectRatio: "4/3" }}
          aria-label="Add car"
        >
          <div className="w-10 h-10 rounded-full bg-[var(--color-bg-hover)] flex items-center justify-center group-hover:bg-[var(--color-accent-muted)] transition-colors">
            <Plus size={18} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
          </div>
          <span className="text-xs font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">
            {label ?? "Add car"}
          </span>
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus size={14} />
          {label ?? "Add car"}
        </Button>
      )}
      <AddCarModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
