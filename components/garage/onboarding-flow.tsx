"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, Check, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { carSchema, type CarInput } from "@/lib/validations";
import { sanitize } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1884 }, (_, i) => CURRENT_YEAR + 1 - i);

type Step = 1 | 2 | 3;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [createdCarId, setCreatedCarId] = useState<string | null>(null);

  // Step 1
  const [form, setForm] = useState<Partial<CarInput>>({ year: CURRENT_YEAR, is_public: false });
  const [errors, setErrors] = useState<Partial<Record<keyof CarInput, string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Step 2
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

  async function handleSaveCar() {
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
      setServerError(error?.message ?? "Failed to save car");
      setSaving(false);
      return;
    }

    setCreatedCarId(data.id);
    setSaving(false);
    setStep(2);
  }

  function handleFileSelect(file: File) {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setUploadError(null);
  }

  async function handleUploadAndFinish() {
    if (!photoFile || !createdCarId) {
      finish();
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
    } catch (err) {
      // Non-blocking: log it, surface a soft note, but always advance into the
      // garage. The car already exists; the user can add a photo later.
      console.warn("[onboarding] photo upload failed, continuing anyway", err);
      setUploadError("Photo didn't upload — you can add one later from your garage.");
    } finally {
      setUploading(false);
      setStep(3);
      setTimeout(finish, 1400);
    }
  }

  function finish() {
    router.refresh();
  }

  const stepLabels = ["Your car", "Add photo", "Done"];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 animate-in">
      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-12">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step > s
                    ? "bg-[var(--color-accent)] text-white"
                    : step === s
                    ? "bg-[var(--color-accent)] text-white ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg)]"
                    : "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                }`}
              >
                {step > s ? <Check size={13} /> : s}
              </div>
              <span
                className={`text-[10px] font-medium hidden sm:block ${
                  step >= s ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {stepLabels[i]}
              </span>
            </div>
            {s < 3 && (
              <div
                className={`h-px w-12 mb-4 transition-colors duration-300 ${
                  step > s ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm">
        {/* ── STEP 1: Car details ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-muted)] border border-[rgba(59,130,246,0.2)] flex items-center justify-center mx-auto mb-5">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <path
                    d="M5 19l3.5-10h11L23 19H5z"
                    stroke="#60a5fa"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8.5 13l2-5h7l2 5H8.5z"
                    stroke="#60a5fa"
                    strokeWidth="1.25"
                    strokeLinejoin="round"
                    fill="rgba(59,130,246,0.1)"
                  />
                  <circle cx="9.5" cy="20.5" r="2.5" stroke="#60a5fa" strokeWidth="1.75" />
                  <circle cx="18.5" cy="20.5" r="2.5" stroke="#60a5fa" strokeWidth="1.75" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Add your first car</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                Tell us about your vehicle to get started
              </p>
            </div>

            {serverError && (
              <div
                className="rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] px-4 py-3 text-xs text-[var(--color-danger)]"
                role="alert"
              >
                {serverError}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Year"
                  value={String(form.year ?? CURRENT_YEAR)}
                  onChange={(e) => setField("year", parseInt(e.target.value))}
                  options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
                />
                <Input
                  label="Make"
                  value={form.make ?? ""}
                  onChange={(e) => setField("make", e.target.value)}
                  error={errors.make}
                  placeholder="Porsche"
                  required
                />
              </div>
              <Input
                label="Model"
                value={form.model ?? ""}
                onChange={(e) => setField("model", e.target.value)}
                error={errors.model}
                placeholder="911 GT3"
                required
              />
              <Input
                label="Nickname"
                value={form.nickname ?? ""}
                onChange={(e) => setField("nickname", e.target.value || null)}
                placeholder="The monster (optional)"
              />
            </div>

            <Button onClick={handleSaveCar} loading={saving} className="w-full" size="lg">
              Continue
              <ChevronRight size={16} />
            </Button>
          </div>
        )}

        {/* ── STEP 2: Photo upload ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-muted)] border border-[rgba(59,130,246,0.2)] flex items-center justify-center mx-auto mb-5">
                <Camera size={26} className="text-[var(--color-accent-bright)]" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Add a photo</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                Your photo fills the car card. Show off your ride.
              </p>
            </div>

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
              className={`relative h-52 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden ${
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
                    alt="Car preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-sm font-semibold text-white">Change photo</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoPreview(null);
                      setPhotoFile(null);
                    }}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-hover)] flex items-center justify-center">
                    <Upload size={20} className="text-[var(--color-text-muted)]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                      Drop a photo here
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      or tap to browse
                    </p>
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

            <div className="space-y-2">
              <Button
                onClick={handleUploadAndFinish}
                loading={uploading}
                disabled={!photoFile}
                className="w-full"
                size="lg"
              >
                {uploading ? "Uploading…" : "Upload & open garage"}
              </Button>
              <Button variant="ghost" onClick={finish} className="w-full" size="md">
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 3 && (
          <div className="text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] flex items-center justify-center mx-auto">
              <Check size={32} className="text-[var(--color-success)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Your garage is ready!</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                Loading your build…
              </p>
            </div>
            <div className="flex justify-center">
              <Loader2 size={18} className="animate-spin text-[var(--color-text-muted)]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
