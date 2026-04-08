"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Globe, Lock, ShieldCheck, ShieldOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { sanitize } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { Car } from "@/lib/supabase/types";

interface EditCarModalProps {
  open: boolean;
  onClose: () => void;
  car: Car;
  /** Number of minted pixel cards for this car (for delete warning + identity prompt) */
  cardCount?: number;
}

const CURRENT_YEAR = new Date().getFullYear();

export function EditCarModal({ open, onClose, car, cardCount = 0 }: EditCarModalProps) {
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
  const [vinInput, setVinInput] = useState(car.vin ?? "");
  const [vinVerified, setVinVerified] = useState(car.vin_verified);
  const [vinVerifying, setVinVerifying] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinSuccess, setVinSuccess] = useState<string | null>(null);
  const vinLocked = vinVerified;

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [identityWarning, setIdentityWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Count how many of the three identity fields have changed.
  // Only block save when 2+ change at once — that looks like a different car.
  const identityDelta = [
    form.make  !== car.make,
    form.model !== car.model,
    form.year  !== car.year,
  ].filter(Boolean).length;

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
      const saveRes = await fetch(`/api/cars/${car.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: trimmed }),
      });
      if (!saveRes.ok) throw new Error("Failed to save VIN");

      const verRes = await fetch(`/api/cars/${car.id}/verify-vin`, { method: "POST" });
      const json = await verRes.json();
      if (!verRes.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "VIN not recognized");
      }

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

  async function persistSave() {
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
      setIdentityWarning(false);
    }
  }

  function handleSave() {
    // Block only when 2+ identity fields change simultaneously — looks like a different car.
    if (identityDelta >= 2 && !identityWarning) {
      setIdentityWarning(true);
      return;
    }
    persistSave();
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${car.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json.error === "string" ? json.error : "Failed to delete");
      }
      haptic("heavy");
      router.push("/garage");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit car" description="Update details, visibility, or delete the vehicle">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </div>
        )}

        {/* ── Identity block (2+ core fields changed — looks like a different car) */}
        {identityWarning && (
          <div className="rounded-xl border border-[rgba(255,59,48,0.4)] bg-[rgba(255,59,48,0.06)] p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">This looks like a different car</p>
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                  You&rsquo;ve changed {identityDelta} of the core identity fields (make, model, year).
                  Would you like to add a new car instead?
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIdentityWarning(false)}
                className="flex-1 h-9 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] cursor-pointer hover:border-[var(--color-border-bright)] transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={() => { onClose(); router.push("/garage"); }}
                className="flex-1 h-9 rounded-lg bg-[var(--color-accent)] text-white text-xs font-bold cursor-pointer hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
              >
                Add new car
              </button>
            </div>
          </div>
        )}

        {/* ── Make / Model ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Input
              label="Make"
              value={form.make}
              onChange={(e) => !vinLocked && setForm((f) => ({ ...f, make: e.target.value }))}
              required
              disabled={vinLocked}
            />
            {vinLocked && <ShieldCheck size={11} className="absolute right-3 bottom-3 text-[#f5d76e]" />}
          </div>
          <div className="relative">
            <Input
              label="Model"
              value={form.model}
              onChange={(e) => !vinLocked && setForm((f) => ({ ...f, model: e.target.value }))}
              required
              disabled={vinLocked}
            />
            {vinLocked && <ShieldCheck size={11} className="absolute right-3 bottom-3 text-[#f5d76e]" />}
          </div>
        </div>

        {/* ── Year / Trim ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Input
              label="Year"
              type="number"
              min={1885}
              max={2030}
              value={String(form.year)}
              onChange={(e) => {
                if (!vinLocked) {
                  const v = parseInt(e.target.value);
                  setForm((f) => ({ ...f, year: isNaN(v) ? CURRENT_YEAR : v }));
                }
              }}
              placeholder="e.g. 2024"
              disabled={vinLocked}
            />
            {vinLocked && <ShieldCheck size={11} className="absolute right-3 bottom-3 text-[#f5d76e]" />}
          </div>
          <div className="relative">
            <Input
              label="Trim"
              value={form.trim}
              onChange={(e) => !vinLocked && setForm((f) => ({ ...f, trim: e.target.value }))}
              placeholder="GT3 RS"
              disabled={vinLocked}
            />
            {vinLocked && <ShieldCheck size={11} className="absolute right-3 bottom-3 text-[#f5d76e]" />}
          </div>
        </div>

        {/* ── VIN field ────────────────────────────────────────────────── */}
        <div>
          <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1.5">
            VIN
          </label>
          {vinVerified ? (
            <div className="flex items-center gap-2.5 h-10 px-3.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[rgba(245,215,110,0.3)]">
              <ShieldCheck size={14} className="text-[#f5d76e] flex-shrink-0" />
              <span className="text-xs font-semibold text-[#f5d76e] font-mono flex-1 truncate">
                {car.vin ?? vinInput}
              </span>
              <span className="text-[10px] text-[#f5d76e]/60 font-semibold">NHTSA VERIFIED</span>
            </div>
          ) : (
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
                {vinVerifying ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
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
        </div>

        {/* ── Color / Nickname ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="Chalk" />
          <Input label="Nickname" value={form.nickname} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} placeholder="The monster" />
        </div>

        {/* ── Description (fully optional) ─────────────────────────────── */}
        <div>
          <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1.5">
            Description <span className="text-[var(--color-text-disabled)]">(optional)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            maxLength={4000}
            placeholder="Tell the story of this build — why this car, where it's headed, what makes it yours."
            className="w-full rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-3.5 py-2.5 text-xs text-white placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-accent)] transition resize-y"
          />
        </div>

        {/* ── Public toggle ────────────────────────────────────────────── */}
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

        {/* ── Save / Cancel ────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={saving || deleting}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} className="flex-1" disabled={deleting}>
            Save changes
          </Button>
        </div>

        {/* ── Delete flow ──────────────────────────────────────────────── */}
        <div className="pt-4 mt-2 border-t border-[var(--color-border)]">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:border-[rgba(255,69,58,0.4)] transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              Delete this car
            </button>
          ) : (
            <div className="rounded-xl border border-[rgba(255,69,58,0.4)] bg-[rgba(255,69,58,0.05)] p-4">
              <p className="text-xs font-bold text-white mb-1">Delete this car permanently?</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">
                The car, its mods, and its photos will be removed.
                {cardCount > 0 && (
                  <>
                    {" "}
                    <span className="text-[#f5d76e] font-semibold">
                      Your {cardCount} minted {cardCount === 1 ? "card stays" : "cards stay"} in your collection forever.
                    </span>
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 h-9 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-9 rounded-lg bg-[var(--color-danger)] text-white text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete forever
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
