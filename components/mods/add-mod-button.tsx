"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddModModal } from "./add-mod-modal";
import type { ModStatus } from "@/lib/supabase/types";

interface AddModButtonProps {
  carId: string;
  defaultStatus?: ModStatus;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}

export function AddModButton({
  carId,
  defaultStatus = "installed",
  label = "Log mod",
  variant = "primary",
}: AddModButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant={variant}>
        <Plus size={14} />
        {label}
      </Button>
      <AddModModal
        open={open}
        onClose={() => setOpen(false)}
        carId={carId}
        defaultStatus={defaultStatus}
      />
    </>
  );
}
