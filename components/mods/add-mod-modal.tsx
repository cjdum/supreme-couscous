"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
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

  // ── UX 8: Free-form AI parse ──
  // Users can dump a one-line description and we'll fill the form for them.
  const [quickText, setQuickText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseFilled, setParseFilled] = useState(false);

  async function handleQuickParse() {
    if (!quickText.trim() || parsing) return;
    setParsing(true);
    setParseError(null);
    setParseFilled(false);
    try {
      const res = await fetch("/api/ai/parse-mod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: quickText.trim(), car_id: carId }),
      });
      const json = await res.json();
      if (!res.ok || !json.mod) {
        setParseError(json.error ?? "Couldn't parse that — try rewording.");
        return;
      }
      // Merge into form, preserving any field the user already changed.
      setForm((prev) => ({
        ...prev,
        name: prev.name || json.mod.name,
        category: (prev.category as ModInput["category"]) || json.mod.category,
        cost: prev.cost ?? json.mod.cost,
        install_date: prev.install_date ?? json.mod.install_date,
        shop_name: prev.shop_name ?? json.mod.shop_name,
        is_diy: prev.is_diy || json.mod.is_diy,
        notes: prev.notes ?? json.mod.notes,
        status: prev.status ?? json.mod.status,
      }));
      setParseFilled(true);
    } catch {
      setParseError("Network error. Please try again.");
    } finally {
      setParsing(false);
    }
  }

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
    onSaved?.();
    handleClose();
  }

  function handleClose() {
    onClose();
    setForm({ status: defaultStatus, is_diy: false, category: "engine" });
    setErrors({});
    setServerError(null);
    setQuickText("");
    setParseError(null);
    setParseFilled(false);
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

        {/* ── Quick add: free-form AI parse ── */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-[var(--color-accent-bright)]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Quick add — describe it in plain English
            </p>
          </div>
          <textarea
            value={quickText}
            onChange={(e) => {
              setQuickText(e.target.value);
              if (parseError) setParseError(null);
              if (parseFilled) setParseFilled(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleQuickParse();
              }
            }}
            placeholder="Injen cold air intake, $230, installed last week at SpeedZone, +12hp"
            rows={2}
            maxLength={1000}
            className="w-full resize-none text-sm"
          />
          {parseError && (
            <p className="text-xs text-[var(--color-danger)]" role="alert">
              {parseError}
            </p>
          )}
          {parseFilled && !parseError && (
            <p className="text-xs text-[var(--color-success)]">
              Filled below — review and edit before saving.
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Only the name is required. ⌘+Enter to parse.
            </p>
            <button
              type="button"
              onClick={handleQuickParse}
              disabled={!quickText.trim() || parsing}
              className="h-8 px-3 rounded-lg bg-[var(--color-accent)] text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              {parsing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Parsing…
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  Auto-fill
                </>
              )}
            </button>
          </div>
        </div>

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
        <div className="flex items-center gap-3">
          <Toggle
            checked={form.is_diy ?? false}
            onChange={(v) => setField("is_diy", v)}
            ariaLabel="DIY install"
          />
          <span className="text-sm font-medium">DIY install</span>
        </div>

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
