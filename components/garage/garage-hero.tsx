"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Sliders, Edit2, Share2, Star, Zap, Camera } from "lucide-react";
import { EditCarModal } from "./edit-car-modal";
import { CarShareCard } from "./car-share-card";
import { ModConfiguratorPanel } from "./mod-configurator-panel";
import type { Car, ModCategory } from "@/lib/supabase/types";

interface GarageHeroProps {
  car: Car;
  modCount: number;
  totalInvested: number;
  isPrimary: boolean;
  username: string;
  buildScore: number;
  buildLevel: string;
  topCategory: ModCategory | null;
  topMods: { name: string; category: ModCategory; cost: number | null }[];
  /** Latest render image (used as the cinematic background when no cover photo is set) */
  latestRenderUrl?: string | null;
}

/**
 * Cinematic edge-to-edge Forza-style hero for the garage.
 *
 * - Static fullscreen photo/render as the hero background (no zoom — motion sick fix)
 * - Very subtle parallax: background translates at 0.3× scroll speed
 * - Deep vignette (dark edges, brighter center) to make the car pop
 * - Bottom gradient overlay → #000000
 * - Smooth fade-in on page load (opacity 0 → 1 over 600ms)
 * - Respects prefers-reduced-motion (disables parallax entirely)
 */
export function GarageHero({
  car,
  isPrimary,
  username,
  buildScore,
  buildLevel,
  modCount,
  totalInvested,
  topCategory,
  topMods,
  latestRenderUrl,
}: GarageHeroProps) {
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // Smooth fade-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Subtle parallax — bail out if user prefers reduced motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let rafId = 0;
    let latest = 0;
    const onScroll = () => {
      latest = window.scrollY;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          setScrollY(latest);
          rafId = 0;
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Real cover photo wins. Renders are a *fallback* — never override the user's actual photo.
  const heroImage = car.cover_image_url ?? latestRenderUrl ?? null;
  const carName = `${car.year} ${car.make} ${car.model}`;

  return (
    <>
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: "calc(100dvh - 64px)",
          minHeight: "560px",
        }}
      >
        {heroImage ? (
          <>
            {/* Static background — 0.3× parallax on scroll (zero zoom, zero Ken Burns) */}
            <div
              className="absolute inset-0 will-change-transform"
              style={{
                transform: `translate3d(0, ${scrollY * 0.3}px, 0)`,
                opacity: mounted ? 1 : 0,
                transition: "opacity 600ms ease-out",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={carName}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: "center center" }}
              />
              {/* Deep radial vignette — darker edges, brighter center, makes the car pop */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 45%, transparent 0%, transparent 35%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.85) 100%)",
                }}
              />
            </div>
          </>
        ) : (
          <EmptyHeroState carId={car.id} />
        )}

        {/* Soft top fade so the top nav/back button has contrast */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-[2]" />

        {/* Bottom gradient — covers the bottom 40% of the screen, transparent → black */}
        <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none z-[2]" />

        {/* Top right: Edit + Share */}
        {heroImage && (
          <div className="absolute top-5 right-5 flex gap-2 z-10">
            <button
              type="button"
              onClick={() => setSharing(true)}
              className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full bg-black/55 backdrop-blur-xl border border-white/15 text-[11px] font-bold text-white hover:bg-black/75 transition-colors cursor-pointer"
              aria-label="Share build"
            >
              <Share2 size={12} />
              Share
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full bg-black/55 backdrop-blur-xl border border-white/15 text-[11px] font-bold text-white hover:bg-black/75 transition-colors cursor-pointer"
              aria-label="Edit car"
            >
              <Edit2 size={11} />
              Edit
            </button>
          </div>
        )}

        {/* Primary badge top left */}
        {isPrimary && heroImage && (
          <div className="absolute top-5 left-5 z-10">
            <div
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase glow-gold"
              style={{
                backgroundColor: "rgba(251,191,36,0.18)",
                border: "1px solid rgba(251,191,36,0.40)",
                color: "#fbbf24",
                backdropFilter: "blur(12px)",
              }}
            >
              <Star size={9} fill="currentColor" /> Primary Build
            </div>
          </div>
        )}

        {/* Bottom row: car info (left) + Customize (right) */}
        {heroImage && (
          <div
            className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 lg:px-12 pb-8 sm:pb-10 z-10 flex items-end justify-between gap-4 transition-all duration-700 ease-out"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(20px)",
            }}
          >
            <div className="min-w-0 flex-1 max-w-3xl">
              {car.nickname && (
                <p className="text-[11px] sm:text-xs font-bold text-[#60A5FA] mb-2 tracking-[0.25em] uppercase truncate">
                  {car.nickname}
                </p>
              )}
              <h1
                className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-[0.95] tracking-tight break-words"
                style={{ textShadow: "0 4px 32px rgba(0,0,0,0.85)" }}
              >
                {car.year} {car.make}
                <br />
                <span className="text-white/90">{car.model}</span>
              </h1>
              {car.trim && (
                <p
                  className="text-sm sm:text-base font-medium text-white/65 mt-2 sm:mt-3 truncate"
                  style={{ textShadow: "0 2px 16px rgba(0,0,0,0.85)" }}
                >
                  {car.trim}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="inline-flex items-center gap-2 px-5 sm:px-6 min-h-[44px] py-3 sm:py-3.5 rounded-full bg-white text-black text-xs sm:text-sm font-bold hover:bg-white/90 transition-all active:scale-95 shadow-[0_8px_32px_rgba(255,255,255,0.18)] flex-shrink-0 cursor-pointer whitespace-nowrap"
              aria-label={`Customize ${carName}`}
            >
              <Sliders size={14} />
              Customize
            </button>
          </div>
        )}
      </div>

      {editing && (
        <EditCarModal open={editing} onClose={() => setEditing(false)} car={car} />
      )}
      {sharing && (
        <CarShareCard
          open={sharing}
          onClose={() => setSharing(false)}
          data={{
            carName,
            carImage: car.cover_image_url,
            buildScore,
            buildLevel,
            modCount,
            totalInvested,
            topCategory,
            topMods,
            username,
          }}
        />
      )}
      {customizing && (
        <ModConfiguratorPanel
          open={customizing}
          onClose={() => setCustomizing(false)}
          carId={car.id}
          carName={carName}
        />
      )}
    </>
  );
}

function EmptyHeroState({ carId }: { carId: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-[1]">
      {/* Subtle radial backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 60%),
                       linear-gradient(180deg, #050505 0%, #000 100%)`,
        }}
      />
      <div className="relative z-10 text-center px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center">
          <Camera size={28} className="text-[var(--color-text-muted)]" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight">Add a real photo</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-sm mx-auto">
          Upload a shot of your actual car — that&apos;s what makes the garage feel real.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-6">
          <Link
            href={`/garage/${carId}#photos`}
            className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3.5 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90 transition-all active:scale-95 shadow-[0_8px_32px_rgba(255,255,255,0.18)]"
          >
            <Camera size={15} />
            Upload photo
            <ChevronRight size={14} />
          </Link>
          <Link
            href={`/visualizer?carId=${carId}`}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-bold hover:bg-white/10 transition-all"
          >
            <Zap size={13} />
            Or try an AI render
          </Link>
        </div>
      </div>
    </div>
  );
}
