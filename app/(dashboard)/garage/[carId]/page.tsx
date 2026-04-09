"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, Loader2, Pencil, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Car {
  id: string;
  year: number;
  make: string;
  model: string;
  color: string | null;
  trim: string | null;
  cover_image_url: string | null;
}

interface Mod {
  id: string;
  name: string;
  status: string;
}

export default function CarDetailPage() {
  const params = useParams();
  const carId = params.carId as string;
  const router = useRouter();

  const [car, setCar] = useState<Car | null>(null);
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Edit form state mirrors the car fields
  const [editYear, setEditYear] = useState("");
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editColor, setEditColor] = useState("");

  // Photo upload
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }

      const { data: carData } = await supabase
        .from("cars")
        .select("id, year, make, model, color, trim, cover_image_url")
        .eq("id", carId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!carData) { router.push("/garage"); return; }
      const c = carData as Car;
      setCar(c);
      setEditYear(String(c.year));
      setEditMake(c.make);
      setEditModel(c.model);
      setEditColor(c.color ?? "");

      const { data: modsData } = await supabase
        .from("mods")
        .select("id, name, status")
        .eq("car_id", carId)
        .eq("status", "installed")
        .order("install_date", { ascending: false })
        .order("created_at", { ascending: false });
      setMods((modsData ?? []) as Mod[]);
      setLoading(false);
    });
  }, [carId, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!car) return;
    const parsedYear = parseInt(editYear, 10);
    if (isNaN(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 2) {
      setSaveError("Enter a valid year");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/cars/${carId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: parsedYear,
          make: editMake.trim(),
          model: editModel.trim(),
          color: editColor.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setCar({ ...car, year: parsedYear, make: editMake.trim(), model: editModel.trim(), color: editColor.trim() || null });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    if (!car) return;
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
    setUploadingPhoto(true);
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const res = await fetch(`/api/cars/${carId}/cover`, { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && json.cover_image_url) {
        setCar({ ...car, cover_image_url: `${json.cover_image_url}?v=${Date.now()}` });
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) {
    return (
      <div className="px-5 sm:px-8 py-10 max-w-2xl mx-auto space-y-3">
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  if (!car) return null;

  const installedMods = mods.filter((m) => m.status === "installed");

  return (
    <div className="max-w-2xl mx-auto pb-12">

      {/* Back */}
      <div className="px-5 sm:px-8 pt-6 pb-4">
        <Link
          href="/garage"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Garage
        </Link>
      </div>

      {/* Car photo */}
      <div className="mx-5 sm:mx-8 relative">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ aspectRatio: "16/9", background: "rgba(17,17,17,1)" }}
        >
          {car.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={car.cover_image_url}
              alt={`${car.year} ${car.make} ${car.model}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background:
                  "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.10) 0%, transparent 65%)",
              }}
            >
              <p className="text-xs text-[var(--color-text-muted)]">No photo</p>
            </div>
          )}

          {/* Photo upload overlay */}
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-bold hover:bg-black/80 transition-colors cursor-pointer disabled:opacity-50"
            aria-label={car.cover_image_url ? "Change photo" : "Add photo"}
          >
            {uploadingPhoto ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Camera size={12} aria-hidden="true" />
            )}
            {car.cover_image_url ? "Change photo" : "Add photo"}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhotoUpload(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Car info */}
      <div className="mx-5 sm:mx-8 mt-5">
        {editing ? (
          <form onSubmit={handleSave} className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 space-y-3">
            <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
              Edit car
            </p>
            {/* Inline note */}
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              Updating your car info will reflect on your next mint.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                  Year
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  placeholder="2024"
                  maxLength={4}
                  required
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                  Color
                </label>
                <input
                  type="text"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder="Arctic White"
                  className="w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                Make
              </label>
              <input
                type="text"
                value={editMake}
                onChange={(e) => setEditMake(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                Model
              </label>
              <input
                type="text"
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
                required
                className="w-full"
              />
            </div>
            {saveError && (
              <p className="text-xs text-[var(--color-danger)]">{saveError}</p>
            )}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => { setEditing(false); setSaveError(null); }}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                {car.year} {car.make} {car.model}
              </h1>
              {car.trim && (
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{car.trim}</p>
              )}
              {car.color && (
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{car.color}</p>
              )}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="flex-shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] hover:text-white transition-all cursor-pointer mt-1"
            >
              {saved ? (
                <><Check size={13} className="text-[var(--color-success)]" /> Saved</>
              ) : (
                <><Pencil size={13} aria-hidden="true" /> Edit</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Installed mods */}
      {installedMods.length > 0 && (
        <div className="mx-5 sm:mx-8 mt-6">
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Mods ({installedMods.length})
          </p>
          <div className="space-y-1.5">
            {installedMods.map((mod) => (
              <div
                key={mod.id}
                className="px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]"
              >
                <p className="text-sm text-[var(--color-text-primary)]">{mod.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mint CTA if no mods */}
      {installedMods.length === 0 && (
        <div className="mx-5 sm:mx-8 mt-6 text-center py-8">
          <p className="text-xs text-[var(--color-text-muted)] mb-4">No installed mods yet.</p>
          <Link
            href="/mint"
            className="inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:brightness-110 transition-all"
          >
            Mint a card anyway
          </Link>
        </div>
      )}

    </div>
  );
}
