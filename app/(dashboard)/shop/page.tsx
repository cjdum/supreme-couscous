"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShoppingBag,
  ExternalLink,
  Plus,
  Receipt,
  Trash2,
  X,
  Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { formatCurrency, formatDate } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { Car, Mod, Purchase } from "@/lib/supabase/types";

interface Retailer {
  key: string;
  name: string;
  specialty: string;
  url: (q: string) => string;
  /** Only show this retailer for these makes (optional) */
  makesOnly?: string[];
  /** Only show for these mod keywords */
  keywords?: string[];
  brandColor: string;
}

const EUROPEAN_MAKES = [
  "audi",
  "bmw",
  "mercedes",
  "mercedes-benz",
  "porsche",
  "volkswagen",
  "vw",
  "mini",
  "volvo",
  "saab",
];

const RETAILERS: Retailer[] = [
  {
    key: "summit",
    name: "Summit Racing",
    specialty: "Performance parts, engine, exhaust, suspension",
    url: (q) => `https://www.summitracing.com/search?keyword=${encodeURIComponent(q)}`,
    brandColor: "#EA1D25",
  },
  {
    key: "amazon",
    name: "Amazon",
    specialty: "General automotive parts and accessories",
    url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
    brandColor: "#FF9900",
  },
  {
    key: "tirerack",
    name: "Tire Rack",
    specialty: "Wheels & tires",
    keywords: ["wheel", "tire", "rim", "tyres"],
    url: (q) => `https://www.tirerack.com/wheels/results.jsp?searchTerm=${encodeURIComponent(q)}`,
    brandColor: "#E6101D",
  },
  {
    key: "ecstuning",
    name: "ECS Tuning",
    specialty: "European OEM & performance parts",
    makesOnly: EUROPEAN_MAKES,
    url: (q) => `https://www.ecstuning.com/Search/SiteSearch/${encodeURIComponent(q)}/`,
    brandColor: "#0099CC",
  },
  {
    key: "crutchfield",
    name: "Crutchfield",
    specialty: "Car audio, head units, speakers",
    keywords: ["audio", "speaker", "subwoofer", "stereo", "head unit", "amp", "amplifier"],
    url: (q) => `https://www.crutchfield.com/g_/MainCategory.aspx?search=${encodeURIComponent(q)}`,
    brandColor: "#0072CE",
  },
];

function buildSearchQuery(car: Car | null, mod: string): string {
  if (!car) return mod;
  return `${car.year} ${car.make} ${car.model} ${mod}`.trim();
}

function relevantRetailers(car: Car | null, modName: string): Retailer[] {
  const make = car?.make.toLowerCase() ?? "";
  const lower = modName.toLowerCase();

  return RETAILERS.filter((r) => {
    if (r.makesOnly && !r.makesOnly.includes(make)) return false;
    if (r.keywords && !r.keywords.some((kw) => lower.includes(kw))) return false;
    return true;
  });
}

function ShopContent() {
  const searchParams = useSearchParams();
  const prefilledMod = searchParams.get("mod") ?? "";
  const prefilledCarId = searchParams.get("carId");

  const [cars, setCars] = useState<Car[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedCarId, setSelectedCarId] = useState(prefilledCarId ?? "");
  const [modSearch, setModSearch] = useState(prefilledMod);
  const [loadingCars, setLoadingCars] = useState(true);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);

  // Initial load
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const [carsRes, modsRes, purchasesRes] = await Promise.all([
        supabase
          .from("cars")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("mods").select("*").eq("user_id", user.id),
        fetch("/api/purchases").then((r) => r.json()),
      ]);

      const carList = (carsRes.data ?? []) as Car[];
      const modList = (modsRes.data ?? []) as Mod[];
      const purchaseList = (purchasesRes?.purchases ?? []) as Purchase[];

      setCars(carList);
      setMods(modList);
      setPurchases(purchaseList);

      if (prefilledCarId && carList.some((c) => c.id === prefilledCarId)) {
        setSelectedCarId(prefilledCarId);
      } else {
        const primary = carList.find((c) => c.is_primary) ?? carList[0];
        if (primary) setSelectedCarId(primary.id);
      }
      setLoadingCars(false);
      setLoadingPurchases(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCar = cars.find((c) => c.id === selectedCarId) ?? null;
  const matchingRetailers = useMemo(
    () => relevantRetailers(selectedCar, modSearch),
    [selectedCar, modSearch]
  );
  const fullQuery = useMemo(
    () => buildSearchQuery(selectedCar, modSearch),
    [selectedCar, modSearch]
  );

  const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0);

  async function deletePurchase(id: string) {
    if (!confirm("Delete this purchase?")) return;
    haptic("medium");
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/purchases?id=${id}`, { method: "DELETE" });
  }

  async function refreshPurchases() {
    const res = await fetch("/api/purchases");
    if (res.ok) {
      const json = await res.json();
      setPurchases((json?.purchases ?? []) as Purchase[]);
    }
  }

  return (
    <PageContainer maxWidth="4xl" className="py-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center flex-shrink-0">
          <ShoppingBag size={20} className="text-[var(--color-accent-bright)]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Shop</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Find real parts at trusted retailers and track every purchase.
          </p>
        </div>
      </div>

      {/* Find Parts */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold tracking-tight">Find Parts</h2>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)]">
            Direct search
          </span>
        </div>

        <div className="rounded-2xl bg-[var(--color-bg-card)] border border-white/10 p-5 sm:p-6 space-y-5">
          {cars.length > 0 ? (
            <Select
              label="Vehicle"
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              options={cars.map((c) => ({
                value: c.id,
                label: `${c.year} ${c.make} ${c.model}${c.nickname ? ` — ${c.nickname}` : ""}`,
              }))}
            />
          ) : (
            !loadingCars && (
              <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">
                Add a car to your garage first to get retailer-specific results.
              </div>
            )
          )}

          <Input
            label="What are you looking for?"
            value={modSearch}
            onChange={(e) => setModSearch(e.target.value)}
            placeholder="Cold air intake, coilovers, big brake kit..."
          />

          {selectedCar && modSearch.trim() && (
            <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-white/5 px-4 py-3 flex items-center gap-2 text-[11px]">
              <Tag size={12} className="text-[var(--color-accent-bright)] flex-shrink-0" />
              <span className="text-[var(--color-text-muted)]">Searching for</span>
              <span className="text-white font-bold truncate">{fullQuery}</span>
            </div>
          )}
        </div>

        {/* Retailer cards */}
        {selectedCar && modSearch.trim() ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {matchingRetailers.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-white/10 py-10 text-center">
                <p className="text-sm font-bold text-[var(--color-text-secondary)]">
                  No specialized retailers for this combo
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                  Try a more common mod term, or search Amazon directly.
                </p>
              </div>
            ) : (
              matchingRetailers.map((r) => (
                <a
                  key={r.key}
                  href={r.url(fullQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl bg-[var(--color-bg-card)] border border-white/10 p-5 hover:border-white/20 hover:bg-[var(--color-bg-elevated)] transition-all cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: r.brandColor }}
                        aria-hidden="true"
                      />
                      <p className="text-sm font-black text-white truncate">{r.name}</p>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                      {r.specialty}
                    </p>
                    <p className="text-[11px] font-bold text-[var(--color-accent-bright)] mt-2 flex items-center gap-1">
                      Search on {r.name}
                      <ExternalLink size={11} />
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center mt-5">
            <ShoppingBag
              size={22}
              className="mx-auto text-[var(--color-text-disabled)] mb-2"
            />
            <p className="text-sm font-bold text-[var(--color-text-secondary)]">
              {selectedCar ? "Type a mod above" : "Select a car and type a mod"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
              We&rsquo;ll generate real search links to the retailers that fit
            </p>
          </div>
        )}
      </section>

      {/* My Purchases */}
      <section>
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold tracking-tight">My Purchases</h2>
            {purchases.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-muted)] border border-[rgba(59,130,246,0.2)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Total
                </span>
                <span className="text-xs font-black text-[var(--color-accent-bright)] tabular">
                  {formatCurrency(totalSpent)}
                </span>
              </div>
            )}
          </div>
          <Button
            onClick={() => setShowLogModal(true)}
            size="sm"
            className="px-4"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Log a purchase</span>
            <span className="sm:hidden">Log</span>
          </Button>
        </div>

        {loadingPurchases ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 skeleton rounded-2xl" />
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
            <Receipt
              size={26}
              className="mx-auto text-[var(--color-text-disabled)] mb-3"
            />
            <p className="text-sm font-bold text-[var(--color-text-secondary)]">
              No purchases logged yet
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5 max-w-sm mx-auto">
              Track every part you buy so you can see exactly what you&rsquo;ve invested in your build.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {purchases.map((p) => {
              const linkedMod = mods.find((m) => m.id === p.mod_id);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-[var(--color-bg-card)] border border-white/10 p-4 sm:p-5 flex items-start justify-between gap-4 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">
                      {p.item_name}
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px]">
                      <span className="text-[var(--color-text-muted)]">
                        {formatDate(p.purchased_at)}
                      </span>
                      {p.retailer && (
                        <span className="text-[var(--color-text-secondary)]">
                          · {p.retailer}
                        </span>
                      )}
                      {linkedMod && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)] font-bold text-[10px]">
                          {linkedMod.name}
                        </span>
                      )}
                    </div>
                    {p.notes && (
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-2 leading-relaxed line-clamp-2">
                        {p.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-base font-black text-[var(--color-accent-bright)] tabular">
                      {formatCurrency(p.price)}
                    </p>
                    <button
                      type="button"
                      onClick={() => deletePurchase(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all cursor-pointer"
                      aria-label="Delete purchase"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showLogModal && (
        <LogPurchaseModal
          open={showLogModal}
          onClose={() => setShowLogModal(false)}
          cars={cars}
          mods={mods}
          defaultCarId={selectedCarId}
          onLogged={async () => {
            await refreshPurchases();
            setShowLogModal(false);
          }}
        />
      )}
    </PageContainer>
  );
}

function LogPurchaseModal({
  open,
  onClose,
  cars,
  mods,
  defaultCarId,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  cars: Car[];
  mods: Mod[];
  defaultCarId: string;
  onLogged: () => void;
}) {
  const [form, setForm] = useState({
    item_name: "",
    price: "",
    retailer: "",
    purchased_at: new Date().toISOString().slice(0, 10),
    car_id: defaultCarId,
    mod_id: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter mods by chosen car
  const availableMods = mods.filter((m) => !form.car_id || m.car_id === form.car_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.item_name.trim()) {
      setError("Item name is required");
      return;
    }
    const priceNum = parseFloat(form.price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("Enter a valid price");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: form.item_name.trim(),
          price: priceNum,
          retailer: form.retailer.trim() || null,
          purchased_at: form.purchased_at,
          notes: form.notes.trim() || null,
          car_id: form.car_id || null,
          mod_id: form.mod_id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed to log purchase");
      }
      haptic("success");
      onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log purchase");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log a purchase" description="Track every dollar going into your build" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </div>
        )}

        <Input
          label="Item name"
          value={form.item_name}
          onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
          required
          placeholder="KW V3 Coilovers"
          maxLength={200}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Price (USD)"
            type="number"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            placeholder="0"
            min="0"
            step="0.01"
            required
          />
          <Input
            label="Date"
            type="date"
            value={form.purchased_at}
            onChange={(e) => setForm((f) => ({ ...f, purchased_at: e.target.value }))}
          />
        </div>

        <Input
          label="Retailer"
          value={form.retailer}
          onChange={(e) => setForm((f) => ({ ...f, retailer: e.target.value }))}
          placeholder="Summit Racing, ECS Tuning..."
          maxLength={120}
        />

        {cars.length > 0 && (
          <Select
            label="Car"
            value={form.car_id}
            onChange={(e) => setForm((f) => ({ ...f, car_id: e.target.value, mod_id: "" }))}
            options={[
              { value: "", label: "No car" },
              ...cars.map((c) => ({
                value: c.id,
                label: `${c.year} ${c.make} ${c.model}`,
              })),
            ]}
          />
        )}

        {form.car_id && availableMods.length > 0 && (
          <Select
            label="Linked mod (optional)"
            value={form.mod_id}
            onChange={(e) => setForm((f) => ({ ...f, mod_id: e.target.value }))}
            options={[
              { value: "", label: "Not linked to a mod" },
              ...availableMods.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        )}

        <Textarea
          label="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Order number, install plan, anything you want to remember..."
          rows={3}
          maxLength={2000}
        />

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={saving}
          >
            <X size={14} />
            Cancel
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            <Plus size={14} />
            Log purchase
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ShopFallback() {
  return (
    <PageContainer maxWidth="4xl" className="py-6">
      <div className="space-y-4">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    </PageContainer>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopFallback />}>
      <ShopContent />
    </Suspense>
  );
}

