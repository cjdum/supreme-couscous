import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench, Globe, Lock, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AddModButton } from "@/components/mods/add-mod-button";
import { ModCard } from "@/components/mods/mod-card";
import { EmptyState } from "@/components/ui/loading";
import type { Car, Mod, ModCategory } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ carId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { carId } = await params;
  const supabase = await createClient();
  const { data: carRaw } = await supabase
    .from("cars")
    .select("make, model, year")
    .eq("id", carId)
    .maybeSingle();
  const car = carRaw as Pick<Car, "make" | "model" | "year"> | null;
  return { title: car ? `${car.year} ${car.make} ${car.model}` : "Car" };
}

export default async function CarDetailPage({ params }: Props) {
  const { carId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: carRaw } = await supabase
    .from("cars")
    .select("*")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();

  const car = carRaw as Car | null;
  if (!car) notFound();

  const { data: modsRaw } = await supabase
    .from("mods")
    .select("*")
    .eq("car_id", carId)
    .order("created_at", { ascending: false });
  const mods = (modsRaw ?? []) as Mod[];

  const installed = mods.filter((m) => m.status === "installed");
  const wishlist = mods.filter((m) => m.status === "wishlist");

  const totalSpent = installed.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  // Spending by category
  const categoryTotals = installed.reduce<Record<ModCategory, number>>(
    (acc, m) => {
      acc[m.category as ModCategory] = (acc[m.category as ModCategory] ?? 0) + (m.cost ?? 0);
      return acc;
    },
    {} as Record<ModCategory, number>
  );
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/garage"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-5"
      >
        <ArrowLeft size={14} />
        Garage
      </Link>

      {/* Car header */}
      <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden mb-6">
        {car.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={car.cover_image_url}
            alt={`${car.year} ${car.make} ${car.model}`}
            className="w-full h-48 object-cover"
          />
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              {car.nickname && (
                <p className="text-xs text-[var(--color-accent-bright)] font-medium mb-1">
                  {car.nickname}
                </p>
              )}
              <h1 className="text-xl font-bold">
                {car.year} {car.make} {car.model}
              </h1>
              {car.trim && (
                <p className="text-sm text-[var(--color-text-secondary)]">{car.trim}</p>
              )}
              {car.color && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{car.color}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              {car.is_public ? (
                <><Globe size={12} className="text-[var(--color-success)]" /> Public</>
              ) : (
                <><Lock size={12} /> Private</>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-[var(--color-border)]">
            <div className="text-center">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Installed</p>
              <p className="text-lg font-bold">{installed.length}</p>
            </div>
            <div className="text-center border-x border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Invested</p>
              <p className="text-lg font-bold text-[var(--color-accent-bright)]">
                {formatCurrency(totalSpent)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Wishlist</p>
              <p className="text-lg font-bold">{wishlist.length}</p>
            </div>
          </div>

          {topCategory && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <DollarSign size={12} />
              Top spend:{" "}
              <CategoryBadge category={topCategory[0] as ModCategory} />
              <span className="text-[var(--color-text-secondary)]">
                {formatCurrency(topCategory[1])}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Modifications</h2>
        <div className="flex gap-2">
          <AddModButton carId={carId} defaultStatus="installed" label="Log mod" />
          <AddModButton carId={carId} defaultStatus="wishlist" label="Add to wishlist" variant="secondary" />
        </div>
      </div>

      {/* Installed */}
      {installed.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={14} className="text-[var(--color-success)]" />
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              Installed ({installed.length})
            </span>
          </div>
          <div className="space-y-3">
            {installed.map((mod) => (
              <ModCard key={mod.id} mod={mod} />
            ))}
          </div>
        </div>
      )}

      {/* Wishlist */}
      {wishlist.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3.5 h-3.5 rounded-sm border-2 border-[var(--color-warning)]" />
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              Wishlist ({wishlist.length})
            </span>
          </div>
          <div className="space-y-3">
            {wishlist.map((mod) => (
              <ModCard key={mod.id} mod={mod} />
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {installed.length === 0 && wishlist.length === 0 && (
        <EmptyState
          icon={<Wrench size={28} />}
          title="No mods yet"
          description="Start logging modifications or add items to your wishlist."
          action={<AddModButton carId={carId} label="Log first mod" />}
        />
      )}

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href={`/visualizer?carId=${carId}`}
          className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-center card-hover"
        >
          <p className="text-lg mb-1">✨</p>
          <p className="text-xs font-medium">AI Visualizer</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Render your build</p>
        </Link>
        <Link
          href={`/shop?carId=${carId}`}
          className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-center card-hover"
        >
          <p className="text-lg mb-1">🛍️</p>
          <p className="text-xs font-medium">Parts Shop</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Curated for your car</p>
        </Link>
      </div>
    </div>
  );
}
