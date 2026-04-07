"use client";

import { useState } from "react";
import { Edit2 } from "lucide-react";
import { EditCarModal } from "./edit-car-modal";
import type { Car } from "@/lib/supabase/types";

interface EditCarButtonProps {
  car: Car;
}

export function EditCarButton({ car }: EditCarButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black/50 backdrop-blur-xl border border-white/[0.10] text-xs font-bold text-white hover:bg-white/[0.10] transition-colors cursor-pointer"
        aria-label="Edit car"
      >
        <Edit2 size={11} />
        Edit
      </button>
      {open && <EditCarModal open={open} onClose={() => setOpen(false)} car={car} />}
    </>
  );
}
