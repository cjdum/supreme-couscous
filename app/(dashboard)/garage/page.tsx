"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, ChevronRight, Car as CarIcon, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Car {
  id: string;
  year: number;
  make: string;
  model: string;
  color: string | null;
  cover_image_url: string | null;
}

export default function GaragePage() {
  const router = useRouter();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase
        .from("cars")
        .select("id, year, make, model, color, cover_image_url")
        .eq("user_id", user.id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });
      setCars((data ?? []) as Car[]);
      setLoading(false);
    });
  }, [router]);

  async function handleAddCar(e: React.FormEvent) {
    e.preventDefault();
    if (!year.trim() || !make.trim() || !model.trim()) return;
    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 2) {
      setAddError("Enter a valid year");
      return;
    }
    setSaving(true);
    setAddError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Check if this user already has any cars — first car becomes primary
      const { count } = await supabase
        .from("cars")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      const isPrimary = (count ?? 0) === 0;

      const { data: inserted, error: insErr } = await supabase
        .from("cars")
        .insert({
          user_id: user.id,
          year: parsedYear,
          make: make.trim(),
          model: model.trim(),
          color: color.trim() || null,
          is_primary: isPrimary,
        })
        .select("id")
        .single();

      if (insErr) throw new Error(insErr.message);
      if (!inserted) throw new Error("Insert returned nothing");

      setShowAdd(false);
      setYear(""); setMake(""); setModel(""); setColor("");
      router.push(`/garage/${inserted.id}`);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add car");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="px-5 sm:px-8 py-10 max-w-2xl mx-auto space-y-3">
        {[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black tracking-tight">Garage</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
        >
          <Plus size={14} aria-hidden="true" />
          Add car
        </button>
      </div>

      {/* Add car form */}
      {showAdd && (
        <div className="mb-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold">New car</p>
            <button
              onClick={() => { setShowAdd(false); setAddError(null); }}
              className="text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer"
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleAddCar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                  Year
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
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
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
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
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Porsche"
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
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="911 Carrera"
                required
                className="w-full"
              />
            </div>
            {addError && (
              <p className="text-xs text-[var(--color-danger)]">{addError}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full h-10 rounded-xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Add car"}
            </button>
          </form>
        </div>
      )}

      {cars.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <CarIcon size={32} className="text-[var(--color-text-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-text-secondary)]">No cars yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm font-bold text-[var(--color-accent)] hover:text-[var(--color-accent-bright)] transition-colors cursor-pointer"
          >
            Add your first car →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cars.map((car) => (
            <Link
              key={car.id}
              href={`/garage/${car.id}`}
              className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] hover:bg-[var(--color-bg-elevated)] transition-all group"
            >
              <div
                className="w-16 h-12 rounded-xl flex-shrink-0 overflow-hidden"
                style={{
                  background: car.cover_image_url
                    ? undefined
                    : "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.12) 0%, rgba(0,0,0,0.4) 100%)",
                }}
              >
                {car.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={car.cover_image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                  {car.year} {car.make} {car.model}
                </p>
                {car.color && (
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{car.color}</p>
                )}
              </div>

              <ChevronRight
                size={16}
                className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] flex-shrink-0 transition-colors"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
