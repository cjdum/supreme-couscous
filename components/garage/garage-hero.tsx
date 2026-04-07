"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Wrench, Zap, TrendingUp, Star, Edit2, Share2 } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EditCarModal } from "./edit-car-modal";
import { CarShareCard } from "./car-share-card";
import { formatCurrency } from "@/lib/utils";
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
}

export function GarageHero({
  car,
  modCount,
  totalInvested,
  isPrimary,
  username,
  buildScore,
  buildLevel,
  topCategory,
  topMods,
}: GarageHeroProps) {
  const [scrollY, setScrollY] = useState(0);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrollY(window.scrollY);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Subtle parallax (capped to avoid huge offsets)
  const parallaxOffset = Math.min(scrollY * 0.25, 120);

  return (
    <>
      <div
        className="relative w-full overflow-hidden"
        style={{
          // Give the photo real breathing room without eating the whole viewport
          height: "clamp(380px, 58vh, 600px)",
        }}
      >
        {car.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={car.cover_image_url}
            alt={`${car.year} ${car.make} ${car.model}`}
            className="absolute inset-0 w-full h-full object-cover animate-cinematic"
            style={{
              // Center the photo cleanly — most car shots frame the car centred,
              // so dead-centre keeps the hood, body and roofline in the frame.
              objectPosition: "center center",
              transform: `translate3d(0, ${parallaxOffset}px, 0)`,
              willChange: "transform",
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 20% 40%, rgba(59,130,246,0.18) 0%, transparent 55%),
                         linear-gradient(160deg, rgba(59,130,246,0.06) 0%, #000 50%)`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 200 90" width="240" fill="none" aria-hidden="true" style={{ opacity: 0.04 }}>
                <path d="M18 72l16-42h132l16 42H18z" stroke="white" strokeWidth="3" strokeLinejoin="round" />
                <ellipse cx="50" cy="74" rx="10" ry="10" stroke="white" strokeWidth="3" />
                <ellipse cx="150" cy="74" rx="10" ry="10" stroke="white" strokeWidth="3" />
              </svg>
            </div>
          </div>
        )}

        {/* Soft top fade so the top nav/back button has contrast */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

        {/* Strong bottom gradient behind text — scoped to bottom half only */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />

        {/* Top right: Edit + Share */}
        <div className="absolute top-5 right-5 flex gap-2 z-10">
          <button
            onClick={() => setSharing(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.15] text-xs font-bold text-white hover:bg-black/70 transition-colors cursor-pointer"
            aria-label="Share build"
          >
            <Share2 size={12} />
            Share
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.15] text-xs font-bold text-white hover:bg-black/70 transition-colors cursor-pointer"
            aria-label="Edit car"
          >
            <Edit2 size={11} />
            Edit
          </button>
        </div>

        {/* Primary badge top left */}
        {isPrimary && (
          <div className="absolute top-5 left-5 z-10">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase glow-gold"
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

        {/* Bottom: car info — smaller, scoped to readable gradient zone */}
        <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-7 z-10">
          <div className="max-w-4xl mx-auto">
            {car.nickname && (
              <p className="text-[11px] font-bold text-[#60A5FA] mb-1.5 tracking-[0.2em] uppercase animate-in">
                {car.nickname}
              </p>
            )}
            <h1
              className="text-xl sm:text-2xl font-bold text-white leading-tight tracking-tight animate-slide-up"
              style={{ textShadow: "0 2px 16px rgba(0,0,0,0.8)" }}
            >
              {car.year} {car.make} {car.model}
              {car.trim && (
                <span className="block text-sm sm:text-base font-medium text-white/55 mt-0.5">
                  {car.trim}
                </span>
              )}
            </h1>

            {/* Stat chips */}
            <div
              className="flex items-center gap-2 flex-wrap mt-4 mb-4 animate-in"
              style={{ animationDelay: "150ms" }}
            >
              {car.horsepower && (
                <StatChip icon={<Zap size={11} className="text-[#fbbf24]" />}>
                  <AnimatedCounter value={car.horsepower} duration={1600} /> hp
                </StatChip>
              )}
              {car.torque && (
                <StatChip icon={<TrendingUp size={11} className="text-[#30d158]" />}>
                  <AnimatedCounter value={car.torque} duration={1600} /> lb-ft
                </StatChip>
              )}
              {modCount > 0 && (
                <StatChip icon={<Wrench size={11} className="text-[#60A5FA]" />}>
                  <AnimatedCounter value={modCount} duration={1400} /> mods
                </StatChip>
              )}
              {totalInvested > 0 && (
                <StatChip>
                  <AnimatedCounter
                    value={totalInvested}
                    duration={1800}
                    format={(n) => formatCurrency(Math.round(n))}
                  />
                </StatChip>
              )}
              {buildScore > 0 && (
                <StatChip icon={<Star size={11} className="text-[#fbbf24]" fill="currentColor" />}>
                  <AnimatedCounter value={buildScore} duration={1500} /> · {buildLevel}
                </StatChip>
              )}
            </div>

            <Link
              href={`/garage/${car.id}`}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 transition-all active:scale-95 shadow-[0_6px_24px_rgba(255,255,255,0.12)] animate-in"
              style={{ animationDelay: "250ms" }}
            >
              Manage Build <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {editing && <EditCarModal open={editing} onClose={() => setEditing(false)} car={car} />}
      {sharing && (
        <CarShareCard
          open={sharing}
          onClose={() => setSharing(false)}
          data={{
            carName: `${car.year} ${car.make} ${car.model}`,
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
    </>
  );
}

function StatChip({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/[0.12]">
      {icon}
      <span className="text-[11px] font-bold text-white tabular">{children}</span>
    </div>
  );
}
