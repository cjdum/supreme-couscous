"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Camera, Upload, X, Check } from "lucide-react";
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
const YEARS = Array.from({ length: CURRENT_YEAR - 1884 }, (_, i) => CURRENT_YEAR + 1 - i);

type EntryTab = "manual" | "vin";
type ModalStep = "details" | "photo";

export function AddCarModal({ open, onClose }: AddCarModalProps) {
  const router = useRouter();

  // Step tracking
  const [step, setStep] = useState<ModalStep>("details");
  const [createdCarId, setCreatedCarId] = useState<string | null>(null);

  // Details step
  const [tab, setTab] = useState<EntryTab>("manual");
  const [vin, setVin] = useState("");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CarInput>>({ year: CURRENT_YEAR, is_public: false });
  const [errors, setErrors] = useState<Partial<Record<keyof CarInput, string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Photo step
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("cars")
      .insert({ ...result.data, user_id: user.id })
      .select("id")
      .single();

    if (error || !data) {
      setServerError(error?.message ?? "Failed to save");
      setSaving(false);
      return;
    }

    setCreatedCarId(data.id);
    setSaving(false);
    setStep("photo");
  }

  function handleFileSelect(file: File) {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setUploadError(null);
  }

  async function handleUploadAndClose() {
    if (!photoFile || !createdCarId) {
      handleFinish();
      return;
    }

    setUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append("photo", photoFile);

    try {
      const res = await fetch(`/api/cars/${createdCarId}/photo`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      handleFinish();
    } catch {
      setUploadError("Upload failed. You can add a photo later.");
    } finally {
      setUploading(false);
    }
  }

  function handleFinish() {
    router.refresh();
    handleClose();
  }

  function handleClose() {
    onClose();
    // Reset all state
    setStep("details");
    setCreatedCarId(null);
    setTab("manual");
    setVin("");
    setVinError(null);
    setForm({ year: CURRENT_YEAR, is_public: false });
    setErrors({});
    setServerError(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setUploadError(null);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "details" ? "Add a car" : "Add a photo"}
      description={
        step === "details"
          ? "Enter your vehicle details"
          : "Your photo will fill the card background"
      }
    >
      {/* ── STEP: Details ── */}
      {step === "details" && (
        <>
          {/* Tabs */}
          <div className="flex bg-[var(--color-bg-elevated)] rounded-[8px] p-1 mb-5">
            {(["manual", "vin"] as EntryTab[]).map((t) => (
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
                onChange={(e) => {
                  setVin(e.target.value.toUpperCase());
                  setVinError(null);
                }}
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
                <div
                  className="rounded-[8px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] px-3 py-2.5 text-xs text-[var(--color-danger)]"
                  role="alert"
                >
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
                  options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
                />
                <Input
                  label="Trim"
                  value={form.trim ?? ""}
                  onChange={(e) => setField("trim", e.target.value || null)}
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
                  <p className="text-sm font-medium">Public build</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Visible to the community</p>
                </div>
              </label>

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSave} loading={saving} className="flex-1">
                  Continue →
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STEP: Photo ── */}
      {step === "photo" && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file?.type.startsWith("image/")) handleFileSelect(file);
            }}
            className={`relative h-44 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden ${
              isDragging
                ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)]"
                : photoPreview
                ? "border-[var(--color-border)]"
                : "border-[var(--color-border)] hover:border-[var(--color-border-bright)] bg-[var(--color-bg-elevated)]"
            }`}
          >
            {photoPreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-sm font-semibold text-white">Change</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoPreview(null);
                    setPhotoFile(null);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center"
                >
                  <X size={12} className="text-white" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2.5 select-none">
                <Camera size={28} className="text-[var(--color-text-muted)]" />
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Drop a photo here
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">or tap to browse</p>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {uploadError && (
            <p className="text-xs text-[var(--color-danger)]" role="alert">
              {uploadError}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleFinish}
              className="flex-1"
              disabled={uploading}
            >
              Skip
            </Button>
            <Button
              onClick={handleUploadAndClose}
              loading={uploading}
              disabled={!photoFile}
              className="flex-1"
            >
              {photoFile ? (
                <>
                  <Upload size={14} />
                  Save photo
                </>
              ) : (
                <>
                  <Check size={14} />
                  Done
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
