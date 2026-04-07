"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, Loader2, Globe, Lock, ShieldCheck, ShieldOff, CheckCircle2 } from "lucide-react";
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
    description: car.description ?? "",
    is_public: car.is_public,
  });

  // VIN state
  const [vinInput, setVinInput]   = useState(car.vin ?? "");
  const [vinVerified, setVinVerified] = useState(car.vin_verified);
  const [vinVerifying, setVinVerifying] = useState(false);
  const [vinError, setVinError]   = useState<string | null>(null);
  const [vinSuccess, setVinSuccess] = useState<string | null>(null);

  // Locked fields (from VIN or from already-verified state)
  const vinLocked = vinVerified;

  const [saving, setSaving]       = useState(false);
  const [selling, setSelling]     = useState(false);
  const [confirmSell, setConfirmSell] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const descLen = form.description.trim().length;

  async function handleVerifyVin() {
    if (vinVerifying) return;
    const trimmed = vinInput.trim().toUpperCase();
    if (trimmed.length !== 17) {
      setVinError("VIN must be exactly 17 characters");
      return;
    }
    setVinVerifying(true);
    setVinError(null);
    setVinSuccess(null);

    try {
      // First save the VIN to the car record, then verify
      const saveRes = await fetch(`/api/cars/${car.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: trimmed }),
      });
      if (!saveRes.ok) throw new Error("Failed to save VIN");

      const verRes = await fetch(`/api/cars/${car.id}/verify-vin`, { method: "POST" });
      const json   = await verRes.json();
      if (!verRes.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "VIN not recognized");
      }

      // Update locked spec fields from NHTSA data
      setForm((f) => ({
        ...f,
        make:  json.make  ?? f.make,
        model: json.model ?? f.model,
        year:  json.year  ?? f.year,
        trim:  json.trim  ?? f.trim,
      }));
      setVinVerified(true);
      setVinSuccess(`Verified: ${json.year} ${json.make} ${json.model}`);
      haptic("success");
    } catch (err) {
      setVinError(err instanceof Error ? err.message : "VIN not recognized");
      haptic("heavy");
    } finally {
      setVinVerifying(false);
    }
  }

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
      description: form.description ? form.description.trim() : null,
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

  async function handleSell() {
    setSelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${car.id}/sell`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json.error === "string" ? json.error : "Failed to sell");
      }
      haptic("heavy");
      router.push("/garage");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sell");
      setSelling(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit car" description="Update details, visibility, or retire the vehicle">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </div>
        )}

        {/* ── Make / Model (locked when VIN verified) ──────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Input
              label="Make"
              value={form.make}
              onChange={(e) => !vinLocked && setForm((f) => ({ ...f, make: e.target.value }))}
              required
              disabled={vinLocked}
            />
            {vinLocked && (
              <ShieldCheck size={11} className="absolute right-3 bottom-3 text-[#f5d76e]" />
            )}
          </div>
          <div className="relative">
            <Input
              label="Model"
              value={form.model}
              onChange={(e) => !vinLocked && setForm((f) => ({ ...f, model: e.target.value }))}
              required
              disabled={vinLocked}
            />
            {vinLocked && (
              <ShieldCheck size={11} className="absolute right-3 bottom-3 text-[#f5d76e]" />
            )}
          </div>
        </div>

        {/* ── Year / Trim (locked when VIN verified) ───────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Select
              label="Year"
              value={String(form.year)}
              onChange={(e) => !vinLocked && setForm((f) => ({ ...f, year: parseInt(e.target.value) }))}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              disabled={vinLocked}
            />
            {vinLocked && (
              <ShieldCheck size={11} className="absolute right-3 bottom-3 text-[#f5d76e]" />
            )}
          </div>
          <div className="relative">
            <Input
              label="Trim"
              value={form.trim}
              onChange={(e) => !vinLocked && setForm((f) => ({ ...f, trim: e.target.value }))}
              placeholder="GT3 RS"
              disabled={vinLocked}
            />
            {vinLocked && (
              <ShieldCheck size={11} className="absolute right-3 bottom-3 text-[#f5d76e]" />
            )}
          </div>
        </div>

        {/* ── VIN field ─────────────────────────────────────────────────── */}
        <div>
          <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1.5">
            VIN
          </label>
          {vinVerified ? (
            /* Already verified — show locked badge */
            <div className="flex items-center gap-2.5 h-10 px-3.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[rgba(245,215,110,0.3)]">
              <ShieldCheck size={14} className="text-[#f5d76e] flex-shrink-0" />
              <span className="text-xs font-semibold text-[#f5d76e] font-mono flex-1 truncate">
                {car.vin ?? vinInput}
              </span>
              <span className="text-[10px] text-[#f5d76e]/60 font-semibold">NHTSA VERIFIED</span>
            </div>
          ) : (
            /* Not yet verified — input + button */
            <div className="flex gap-2">
              <input
                value={vinInput}
                onChange={(e) => {
                  setVinInput(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ""));
                  setVinError(null);
                  setVinSuccess(null);
                }}
                maxLength={17}
                placeholder="1HGCM82633A123456"
                className="flex-1 h-10 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-3.5 text-xs font-mono text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-accent)] transition"
              />
              <button
                onClick={handleVerifyVin}
                disabled={vinVerifying || vinInput.length !== 17}
                className="h-10 px-3.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 flex-shrink-0"
              >
                {vinVerifying ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ShieldCheck size={12} />
                )}
                {vinVerifying ? "Checking…" : "Verify"}
              </button>
            </div>
          )}

          {vinError && (
            <p className="flex items-center gap-1 mt-1.5 text-[10px] text-[var(--color-danger)]">
              <ShieldOff size={10} /> {vinError}
            </p>
          )}
          {vinSuccess && (
            <p className="flex items-center gap-1 mt-1.5 text-[10px] text-[#30d158]">
              <CheckCircle2 size={10} /> {vinSuccess} — specs locked from NHTSA
            </p>
          )}
          {!vinVerified && !vinError && !vinSuccess && (
            <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
              Verifying unlocks BUILDER/LEGEND card rarity
            </p>
          )}
        </div>

        {/* ── Color / Nickname ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="Chalk" />
          <Input label="Nickname" value={form.nickname} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} placeholder="The monster" />
        </div>

        {/* ── Description ──────────────────────────────────────────────── */}
        <div>
          <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1.5">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            maxLength={4000}
            placeholder="Tell the story of this build — why this car, where it's headed, what makes it yours."
            className="w-full rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-3.5 py-2.5 text-xs text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-accent)] transition resize-y"
          />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
            {descLen} chars — a vivid story helps generate a better card
          </p>
        </div>

        {/* ── Public toggle ─────────────────────────────────────────────── */}
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

        {/* ── Save / Cancel ─────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={saving || selling}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} className="flex-1" disabled={selling}>
            Save changes
          </Button>
        </div>

        {/* ── Sell flow ─────────────────────────────────────────────────── */}
        {!car.is_sold && (
          <div className="pt-4 mt-2 border-t border-[var(--color-border)]">
            {!confirmSell ? (
              <button
                onClick={() => setConfirmSell(true)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] transition-colors cursor-pointer"
              >
                <Tag size={13} />
                Sell this car
              </button>
            ) : (
              <div className="rounded-xl border border-[var(--color-border-bright)] bg-[var(--color-bg-elevated)] p-4">
                <p className="text-xs font-bold text-white mb-1">Mark this car as sold?</p>
                <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">
                  It will move out of your active garage and into &ldquo;Past Builds&rdquo; on
                  your profile. Mods, photos, and the pixel card stay with it forever.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmSell(false)}
                    disabled={selling}
                    className="flex-1 h-9 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSell}
                    disabled={selling}
                    className="flex-1 h-9 rounded-lg bg-white text-black text-xs font-bold hover:brightness-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {selling ? <Loader2 size={13} className="animate-spin" /> : <Tag size={13} />}
                    Yes, sell it
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
