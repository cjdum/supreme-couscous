"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddModModal } from "./add-mod-modal";
import { AwardReveal } from "@/components/awards/award-reveal";
import { useAwardCheck } from "@/lib/hooks/use-award-check";
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
  const { unlocked, check, dismiss } = useAwardCheck();

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
        onSaved={check}
      />
      {unlocked.length > 0 && <AwardReveal awardIds={unlocked} onClose={dismiss} />}
    </>
  );
}
