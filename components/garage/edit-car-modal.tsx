"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Globe, Lock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { sanitize } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { Car } from "@/lib/supabase/types";

interface EditCarModalProps {
  open: boolean;
  onClose: () => void;
  car: Car;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1884 }, (_, i) => CURRENT_YEAR + 1 - i);

export function EditCarModal({ open, onClose, car }: EditCarModalProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    make: car.make,
    model: car.model,
    year: car.year,
    trim: car.trim ?? "",
    color: car.color ?? "",
    nickname: car.nickname ?? "",
    is_public: car.is_public,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload = {
      make: sanitize(form.make),
      model: sanitize(form.model),
      year: form.year,
      trim: form.trim ? sanitize(form.trim) : null,
      color: form.color ? sanitize(form.color) : null,
      nickname: form.nickname ? sanitize(form.nickname) : null,
      is_public: form.is_public,
    };

    try {
      const res = await fetch(`/api/cars/${car.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json.error === "string" ? json.error : "Failed to save");
      }
      haptic("success");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${car.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      haptic("heavy");
      router.push("/garage");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit car" description="Update details, visibility, or remove the vehicle">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Make" value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} required />
          <Input label="Model" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Year"
            value={String(form.year)}
            onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value) }))}
            options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
          />
          <Input label="Trim" value={form.trim} onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))} placeholder="GT3 RS" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="Chalk" />
          <Input label="Nickname" value={form.nickname} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} placeholder="The monster" />
        </div>

        <div className="flex items-center gap-3">
          <Toggle
            checked={form.is_public}
            onChange={(v) => setForm((f) => ({ ...f, is_public: v }))}
            ariaLabel="Public build"
          />
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5">
              {form.is_public ? (
                <Globe size={12} className="text-[var(--color-success)]" />
              ) : (
                <Lock size={12} className="text-[var(--color-text-muted)]" />
              )}
              Public build
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {form.is_public ? "Visible to the community" : "Only you can see this"}
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={saving || deleting}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} className="flex-1" disabled={deleting}>
            Save changes
          </Button>
        </div>

        {/* Danger zone */}
        <div className="pt-4 mt-2 border-t border-[var(--color-border)]">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.18)] text-xs font-bold text-[var(--color-danger)] hover:bg-[rgba(255,69,58,0.16)] transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              Delete car
            </button>
          ) : (
            <div className="rounded-xl border border-[rgba(255,69,58,0.25)] bg-[var(--color-danger-muted)] p-4">
              <p className="text-xs font-bold text-[var(--color-danger)] mb-1">Delete this car permanently?</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">
                All mods, photos, and renders for this car will be deleted. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 h-9 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-9 rounded-lg bg-[var(--color-danger)] text-white text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Yes, delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
