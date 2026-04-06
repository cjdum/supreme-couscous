"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddCarModal } from "./add-car-modal";

interface AddCarButtonProps {
  label?: string;
}

export function AddCarButton({ label }: AddCarButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus size={14} />
        {label ?? "Add car"}
      </Button>
      <AddCarModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
