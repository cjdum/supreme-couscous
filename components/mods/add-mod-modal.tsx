"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
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
}

export function AddModModal({ open, onClose, carId, defaultStatus = "installed" }: AddModModalProps) {
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
      shop_name: form.shop_name ? sanitize(form.shop_name) : null,
      notes: form.notes ? sanitize(form.notes) : null,
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
      title={defaultStatus === "wishlist" ? "Add to wishlist" : "Log modification"}
      description="Document the details of this mod"
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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Cost (USD)"
            type="number"
            value={form.cost != null ? String(form.cost) : ""}
            onChange={(e) =>
              setField("cost", e.target.value ? parseFloat(e.target.value) : null)
            }
            error={errors.cost}
            placeholder="0"
            min="0"
          />
          <Input
            label="Install date"
            type="date"
            value={form.install_date ?? ""}
            onChange={(e) => setField("install_date", e.target.value || null)}
          />
        </div>

        {/* DIY toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setField("is_diy", !form.is_diy)}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              form.is_diy ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-hover)]"
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                form.is_diy ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </div>
          <span className="text-sm font-medium">DIY install</span>
        </label>

        {!form.is_diy && (
          <Input
            label="Shop name"
            value={form.shop_name ?? ""}
            onChange={(e) => setField("shop_name", e.target.value || null)}
            placeholder="Performance Auto Works"
          />
        )}

        <Textarea
          label="Notes"
          value={form.notes ?? ""}
          onChange={(e) => setField("notes", e.target.value || null)}
          placeholder="Add any notes, part numbers, or installation details…"
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
