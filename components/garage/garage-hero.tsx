"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Sliders, Edit2, Share2, Star, Zap, ImageIcon } from "lucide-react";
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
 * Cinematic, edge-to-edge Forza-style hero for the garage.
 *
 * - The car render / cover photo fills the entire viewport (no margins)
 * - Subtle Ken Burns zoom from 1.0 → 1.08 over 12s, looped with crossfade
 * - Bottom 40% gradient overlay → #000000
 * - Car name + year sit on the gradient bottom-left
 * - "Customize" button bottom-right opens the mod configurator panel
 * - When no render and no photo: dark placeholder + CTA to /visualizer
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

  // Trigger mount-in fade. We delay one frame to let the browser paint
  // the hidden state first so the transition actually runs.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const heroImage = latestRenderUrl ?? car.cover_image_url ?? null;
  const carName = `${car.year} ${car.make} ${car.model}`;

  return (
    <>
      <div
        className="relative w-full overflow-hidden"
        style={{
          // Edge-to-edge: fill the entire viewport. Account for the
          // top bar (mobile only — desktop uses sidebar layout).
          height: "calc(100dvh - 64px)",
          // On desktop, the layout has no top bar so we can fill more.
          // The 64px subtraction is the mobile top-bar height.
          minHeight: "560px",
        }}
      >
        {heroImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={carName}
              className="absolute inset-0 w-full h-full object-cover ken-burns"
              style={{ objectPosition: "center center" }}
            />
            {/* Crossfade duplicate for seamless loop */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover ken-burns ken-burns-delay"
              style={{ objectPosition: "center center" }}
            />
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/55 backdrop-blur-xl border border-white/15 text-[11px] font-bold text-white hover:bg-black/75 transition-colors cursor-pointer"
              aria-label="Share build"
            >
              <Share2 size={12} />
              Share
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/55 backdrop-blur-xl border border-white/15 text-[11px] font-bold text-white hover:bg-black/75 transition-colors cursor-pointer"
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
                <p className="text-[11px] sm:text-xs font-bold text-[#60A5FA] mb-2 tracking-[0.25em] uppercase">
                  {car.nickname}
                </p>
              )}
              <h1
                className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-[0.95] tracking-tight"
                style={{ textShadow: "0 4px 32px rgba(0,0,0,0.85)" }}
              >
                {car.year} {car.make}
                <br />
                <span className="text-white/90">{car.model}</span>
              </h1>
              {car.trim && (
                <p
                  className="text-sm sm:text-base font-medium text-white/65 mt-2 sm:mt-3"
                  style={{ textShadow: "0 2px 16px rgba(0,0,0,0.85)" }}
                >
                  {car.trim}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-full bg-white text-black text-xs sm:text-sm font-bold hover:bg-white/90 transition-all active:scale-95 shadow-[0_8px_32px_rgba(255,255,255,0.18)] flex-shrink-0 cursor-pointer whitespace-nowrap"
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

      <style jsx>{`
        .ken-burns {
          animation: kenBurns 12s ease-in-out infinite alternate;
          will-change: transform;
        }
        .ken-burns-delay {
          animation-delay: 6s;
          opacity: 0;
          animation-name: kenBurnsCrossfade;
        }
        @keyframes kenBurns {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.08);
          }
        }
        @keyframes kenBurnsCrossfade {
          0% {
            transform: scale(1);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: scale(1.08);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ken-burns,
          .ken-burns-delay {
            animation: none !important;
            opacity: 1;
          }
          .ken-burns-delay {
            display: none;
          }
        }
      `}</style>
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
          <ImageIcon size={28} className="text-[var(--color-text-muted)]" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight">No render yet</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-sm mx-auto">
          Generate your first AI render to make this garage truly cinematic.
        </p>
        <Link
          href={`/visualizer?carId=${carId}`}
          className="inline-flex items-center gap-2 mt-6 px-6 py-3.5 rounded-full bg-[var(--color-accent)] text-white text-sm font-bold hover:brightness-110 transition-all active:scale-95 shadow-[0_8px_32px_rgba(59,130,246,0.35)]"
        >
          <Zap size={15} />
          Generate your first render
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
