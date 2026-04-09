import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Globe, Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CarDetailTabs } from "@/components/garage/car-detail-tabs";
import { PixelCard } from "@/components/garage/pixel-card";
import { CarGallery } from "@/components/garage/car-gallery";
import { EditCarButton } from "@/components/garage/edit-car-button";
import type { Car, Mod, Render } from "@/lib/supabase/types";
import type { MintedCard } from "@/lib/pixel-card";

interface Props {
  params: Promise<{ carId: string }>;
  searchParams: Promise<{ action?: string }>;
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
  return { title: car ? `${car.year} ${car.make} ${car.model} — MODVAULT` : "Car" };
}

export default async function CarDetailPage({ params, searchParams }: Props) {
  const { carId } = await params;
  const { action } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  // Renders for the new "Renders" tab + set-as-banner workflow
  const { data: rendersRaw } = await supabase
    .from("renders")
    .select("*")
    .eq("car_id", carId)
    .not("image_url", "is", null)
    .order("is_banner", { ascending: false })
    .order("created_at", { ascending: false });
  const renders = (rendersRaw ?? []) as Render[];

  const { count: photoCount } = await supabase
    .from("car_photos")
    .select("id", { count: "exact", head: true })
    .eq("car_id", carId);
  void photoCount;

  // All pixel cards for this car (timeline + latest)
  const { data: allCardsRaw } = await supabase
    .from("pixel_cards")
    .select("*")
    .eq("car_id", carId)
    .eq("user_id", user.id)
    .order("minted_at", { ascending: true }); // oldest first for timeline
  const allCarCards = (allCardsRaw ?? []) as MintedCard[];
  const cardCount = allCarCards.length;
  const latestCard = allCarCards.length > 0 ? allCarCards[allCarCards.length - 1] : null;

  const installed = mods.filter((m) => m.status === "installed");
  const wishlist = mods.filter((m) => m.status === "wishlist");

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ height: "clamp(280px, 45vw, 460px)" }}>
        {car.cover_image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={car.cover_image_url}
              alt={`${car.year} ${car.make} ${car.model}`}
              className="absolute inset-0 w-full h-full object-cover animate-cinematic"
              style={{ objectPosition: "center center" }}
            />
            {/* Vignette to make the car pop */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 45%, transparent 0%, transparent 40%, rgba(0,0,0,0.45) 90%, rgba(0,0,0,0.7) 100%)",
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.15) 0%, transparent 65%),
                             linear-gradient(160deg, rgba(59,130,246,0.06) 0%, #000 65%)`,
            }}
          />
        )}
        {/* Top fade for back button */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        {/* Bottom gradient behind text */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />

        {/* Back */}
        <div className="absolute top-4 left-4 lg:top-6 lg:left-6">
          <Link
            href="/garage"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white/75 hover:text-white transition-colors bg-black/50 backdrop-blur-xl px-3.5 py-2 rounded-xl border border-white/[0.10]"
          >
            <ArrowLeft size={12} />
            Garage
          </Link>
        </div>

        {/* Top right: Edit + Public badge */}
        <div className="absolute top-4 right-4 lg:top-6 lg:right-6 flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold backdrop-blur-xl border border-white/[0.10]"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              color: car.is_public ? "#30d158" : "#888",
            }}
          >
            {car.is_public ? <><Globe size={10} /> Public</> : <><Lock size={10} /> Private</>}
          </div>
          <EditCarButton car={car} cardCount={cardCount ?? 0} />
        </div>

        {/* Car title over hero */}
        {car.cover_image_url && (
          <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-7">
            <div className="max-w-6xl mx-auto">
              {car.nickname && (
                <p className="text-[11px] font-bold text-[#60A5FA] mb-1 tracking-[0.2em] uppercase">{car.nickname}</p>
              )}
              <h1
                className="text-xl sm:text-2xl font-bold text-white leading-tight tracking-tight"
                style={{ textShadow: "0 2px 16px rgba(0,0,0,0.8)" }}
              >
                {car.year} {car.make} {car.model}
              </h1>
              {car.trim && (
                <p className="text-sm text-white/55 mt-0.5 font-medium" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>
                  {car.trim}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Car title without photo */}
      {!car.cover_image_url && (
        <div className="px-5 sm:px-8 pt-6 pb-2">
          {car.nickname && (
            <p className="text-xs font-bold text-[#60A5FA] mb-1 tracking-[0.15em] uppercase">{car.nickname}</p>
          )}
          <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight">
            {car.year} {car.make} {car.model}
          </h1>
          {car.trim && <p className="text-sm text-[var(--color-text-muted)] mt-1">{car.trim}</p>}
        </div>
      )}

      {/* ── Main content — gallery + tabs. The tabs already show counts via
           their badge, so stats bars and highlight cards were redundant. ── */}
      <div className="px-5 sm:px-8 pb-12 mt-6 space-y-6">
        <CarGallery carId={carId} initialCoverUrl={car.cover_image_url} />
        <CarDetailTabs installed={installed} wishlist={wishlist} renders={renders} carId={carId} />

        {/* Hidden PixelCard — only used when you hit the page with ?action=mint,
            e.g. from the "mint now" deep link. The normal mint flow lives on
            /mint. */}
        {action === "mint" && (
          <div className="mt-4">
            <PixelCard
              carId={carId}
              carLabel={`${car.year} ${car.make} ${car.model}`}
              latestCard={latestCard}
              cardCount={cardCount}
              trim={car.trim}
              color={car.color}
              autoMint
            />
          </div>
        )}
      </div>
    </div>
  );
}

