"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea, Select } from "@/components/ui/input";
import { Autocomplete } from "@/components/ui/autocomplete";
import { createClient } from "@/lib/supabase/client";
import { modSchema, type ModInput } from "@/lib/validations";
import { MOD_CATEGORIES, sanitize } from "@/lib/utils";
import { searchMods } from "@/lib/vehicle-data";
import type { ModStatus } from "@/lib/supabase/types";

interface AddModModalProps {
  open: boolean;
  onClose: () => void;
  carId: string;
  defaultStatus?: ModStatus;
  onSaved?: () => void;
}

// Mods are now just tags: name, category, status, optional notes.
// Cost / dates / shop info are intentionally gone — the card is the product,
// the mod list is just what's on the car.
export function AddModModal({ open, onClose, carId, defaultStatus = "installed", onSaved }: AddModModalProps) {
  const router = useRouter();
  const [form, setForm] = useState<Partial<ModInput>>({
    status: defaultStatus,
    is_diy: false,
    category: "engine",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ModInput, string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function setField<K extends keyof ModInput>(key: K, value: ModInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSave() {
    const sanitized: Partial<ModInput> = {
      ...form,
      name: form.name ? sanitize(form.name) : "",
      notes: form.notes ? sanitize(form.notes) : null,
      // Explicitly clear the legacy money/date/shop columns so existing rows
      // can't bleed stale defaults back in.
      cost: null,
      install_date: null,
      shop_name: null,
      is_diy: false,
    };

    const result = modSchema.safeParse(sanitized);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(
          Object.entries(flat).map(([k, v]) => [k, v?.[0]])
        ) as Partial<Record<keyof ModInput, string>>
      );
      return;
    }

    setSaving(true);
    setServerError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error } = await supabase.from("mods").insert({
      ...result.data,
      car_id: carId,
      user_id: user.id,
    });

    if (error) {
      setServerError(error.message);
      setSaving(false);
      return;
    }

    router.refresh();
    onSaved?.();
    handleClose();
  }

  function handleClose() {
    onClose();
    setForm({ status: defaultStatus, is_diy: false, category: "engine" });
    setErrors({});
    setServerError(null);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={defaultStatus === "wishlist" ? "Add to wishlist" : "Add a mod"}
      description="Just the name, category, and notes if you want."
      size="md"
    >
      <div className="space-y-4">
        {serverError && (
          <div className="rounded-[8px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] px-3 py-2.5 text-xs text-[var(--color-danger)]" role="alert">
            {serverError}
          </div>
        )}

        <Autocomplete
          label="Modification name"
          value={form.name ?? ""}
          onChange={(v) => setField("name", v)}
          suggestions={searchMods(form.category ?? "engine", form.name ?? "", 10)}
          error={errors.name}
          placeholder="Start typing or pick from the list..."
          required
          hint={`Suggestions based on category: ${form.category ?? "engine"}`}
          maxLength={120}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            value={form.category ?? "engine"}
            onChange={(e) => setField("category", e.target.value as ModInput["category"])}
            options={MOD_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />

          <Select
            label="Status"
            value={form.status ?? "installed"}
            onChange={(e) => setField("status", e.target.value as ModStatus)}
            options={[
              { value: "installed", label: "Installed" },
              { value: "wishlist", label: "Wishlist" },
            ]}
          />
        </div>

        <Textarea
          label="Notes (optional)"
          value={form.notes ?? ""}
          onChange={(e) => setField("notes", e.target.value || null)}
          placeholder="Part numbers, install tips, or anything else…"
          rows={3}
          hint="Max 2,000 characters"
        />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">
            Save mod
          </Button>
        </div>
      </div>
    </Modal>
  );
}
