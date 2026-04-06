"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { carSchema, type CarInput } from "@/lib/validations";
import { sanitize } from "@/lib/utils";

interface AddCarModalProps {
  open: boolean;
  onClose: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1984 }, (_, i) => CURRENT_YEAR + 1 - i);

type Tab = "manual" | "vin";

export function AddCarModal({ open, onClose }: AddCarModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("manual");
  const [vin, setVin] = useState("");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<CarInput>>({
    year: CURRENT_YEAR,
    is_public: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CarInput, string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function setField<K extends keyof CarInput>(key: K, value: CarInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleVinLookup() {
    if (vin.length !== 17) {
      setVinError("VIN must be exactly 17 characters");
      return;
    }
    setVinLoading(true);
    setVinError(null);
    try {
      const res = await fetch(`/api/cars/vin?vin=${encodeURIComponent(vin)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "VIN lookup failed");
      setForm((prev) => ({
        ...prev,
        make: json.make,
        model: json.model,
        year: json.year,
        trim: json.trim ?? null,
        vin,
      }));
      setTab("manual");
    } catch (err) {
      setVinError(err instanceof Error ? err.message : "VIN lookup failed");
    } finally {
      setVinLoading(false);
    }
  }

  async function handleSave() {
    const sanitized = {
      ...form,
      make: form.make ? sanitize(form.make) : "",
      model: form.model ? sanitize(form.model) : "",
      nickname: form.nickname ? sanitize(form.nickname) : null,
      notes: undefined,
    };

    const result = carSchema.safeParse(sanitized);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(
          Object.entries(flat).map(([k, v]) => [k, v?.[0]])
        ) as Partial<Record<keyof CarInput, string>>
      );
      return;
    }

    setSaving(true);
    setServerError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error } = await supabase.from("cars").insert({
      ...result.data,
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
    setForm({ year: CURRENT_YEAR, is_public: false });
    setErrors({});
    setServerError(null);
    setVin("");
    setVinError(null);
    setTab("manual");
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add a car"
      description="Add a vehicle to your garage"
    >
      {/* Tabs */}
      <div className="flex bg-[var(--color-bg-elevated)] rounded-[8px] p-1 mb-5">
        {(["manual", "vin"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 h-8 text-xs font-medium rounded-[6px] transition-all cursor-pointer capitalize ${
              tab === t
                ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t === "vin" ? "VIN Lookup" : "Manual Entry"}
          </button>
        ))}
      </div>

      {tab === "vin" && (
        <div className="space-y-3 mb-5">
          <Input
            label="VIN"
            value={vin}
            onChange={(e) => { setVin(e.target.value.toUpperCase()); setVinError(null); }}
            error={vinError ?? undefined}
            placeholder="1HGCM82633A123456"
            maxLength={17}
            hint="17-character Vehicle Identification Number"
          />
          <Button
            onClick={handleVinLookup}
            loading={vinLoading}
            className="w-full"
            variant="secondary"
          >
            <Search size={14} />
            Look up VIN
          </Button>
          {form.make && (
            <p className="text-xs text-[var(--color-success)] text-center">
              Found: {form.year} {form.make} {form.model} — switch to Manual to confirm
            </p>
          )}
        </div>
      )}

      {tab === "manual" && (
        <div className="space-y-4">
          {serverError && (
            <div className="rounded-[8px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] px-3 py-2.5 text-xs text-[var(--color-danger)]" role="alert">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Make"
              value={form.make ?? ""}
              onChange={(e) => setField("make", e.target.value)}
              error={errors.make}
              placeholder="Porsche"
              required
            />
            <Input
              label="Model"
              value={form.model ?? ""}
              onChange={(e) => setField("model", e.target.value)}
              error={errors.model}
              placeholder="911 GT3 RS"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Year"
              value={String(form.year ?? CURRENT_YEAR)}
              onChange={(e) => setField("year", parseInt(e.target.value))}
              error={errors.year}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
            />
            <Input
              label="Trim"
              value={form.trim ?? ""}
              onChange={(e) => setField("trim", e.target.value || null)}
              error={errors.trim ?? undefined}
              placeholder="RS Weissach"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Color"
              value={form.color ?? ""}
              onChange={(e) => setField("color", e.target.value || null)}
              placeholder="Chalk"
            />
            <Input
              label="Nickname"
              value={form.nickname ?? ""}
              onChange={(e) => setField("nickname", e.target.value || null)}
              placeholder="The monster"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setField("is_public", !form.is_public)}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                form.is_public ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-hover)]"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  form.is_public ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Public build</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Other users can browse this car
              </p>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">
              Add car
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
