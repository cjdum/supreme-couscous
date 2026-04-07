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

  // Subtle parallax on scroll
  useEffect(() => {
    function onScroll() {
      setScrollY(window.scrollY);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const parallaxOffset = Math.min(scrollY * 0.4, 200);

  return (
    <>
      <div className="relative w-full overflow-hidden" style={{ height: "100vh", maxHeight: "780px", minHeight: "520px" }}>
        {car.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={car.cover_image_url}
            alt={`${car.year} ${car.make} ${car.model}`}
            className="absolute inset-0 w-full h-full object-cover animate-cinematic"
            style={{ transform: `translate3d(0, ${parallaxOffset}px, 0) scale(${1 + scrollY * 0.0003})`, willChange: "transform" }}
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

        {/* Vignette + bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)",
          }}
        />

        {/* Top right: Edit + Share */}
        <div className="absolute top-20 right-5 flex gap-2 z-10">
          <button
            onClick={() => setSharing(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] text-xs font-bold text-white hover:bg-white/[0.15] transition-colors cursor-pointer"
            aria-label="Share build"
          >
            <Share2 size={12} />
            Share
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] text-xs font-bold text-white hover:bg-white/[0.15] transition-colors cursor-pointer"
            aria-label="Edit car"
          >
            <Edit2 size={11} />
            Edit
          </button>
        </div>

        {/* Primary badge top left */}
        {isPrimary && (
          <div className="absolute top-20 left-5 z-10">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase glow-gold"
              style={{
                backgroundColor: "rgba(251,191,36,0.12)",
                border: "1px solid rgba(251,191,36,0.30)",
                color: "#fbbf24",
                backdropFilter: "blur(12px)",
              }}
            >
              <Star size={9} fill="currentColor" /> Primary Build
            </div>
          </div>
        )}

        {/* Bottom: car info */}
        <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-10 z-10">
          <div className="max-w-4xl mx-auto">
            {car.nickname && (
              <p className="text-xs font-bold text-[#60A5FA] mb-2 tracking-[0.2em] uppercase animate-in">
                {car.nickname}
              </p>
            )}
            <h1
              className="text-5xl sm:text-7xl lg:text-8xl font-black text-white leading-[0.95] mb-3 tracking-tight display-num animate-slide-up"
              style={{ textShadow: "0 4px 32px rgba(0,0,0,0.6)" }}
            >
              {car.year} {car.make}
              <br />
              <span className="text-gradient">{car.model}</span>
            </h1>
            {car.trim && (
              <p className="text-sm sm:text-base text-white/40 mb-6 font-medium animate-in" style={{ animationDelay: "150ms" }}>
                {car.trim}
              </p>
            )}

            {/* Animated stat chips */}
            <div className="flex items-center gap-2.5 flex-wrap mb-7 animate-in" style={{ animationDelay: "200ms" }}>
              {car.horsepower && (
                <StatChip icon={<Zap size={12} className="text-[#fbbf24]" />}>
                  <AnimatedCounter value={car.horsepower} duration={1600} /> hp
                </StatChip>
              )}
              {car.torque && (
                <StatChip icon={<TrendingUp size={12} className="text-[#30d158]" />}>
                  <AnimatedCounter value={car.torque} duration={1600} /> lb-ft
                </StatChip>
              )}
              {modCount > 0 && (
                <StatChip icon={<Wrench size={12} className="text-[#60A5FA]" />}>
                  <AnimatedCounter value={modCount} duration={1400} /> mods
                </StatChip>
              )}
              {totalInvested > 0 && (
                <StatChip>
                  <AnimatedCounter value={totalInvested} duration={1800} format={(n) => formatCurrency(Math.round(n))} />
                </StatChip>
              )}
              {buildScore > 0 && (
                <StatChip icon={<Star size={12} className="text-[#fbbf24]" fill="currentColor" />}>
                  <AnimatedCounter value={buildScore} duration={1500} /> · {buildLevel}
                </StatChip>
              )}
            </div>

            <Link
              href={`/garage/${car.id}`}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-black text-sm font-black hover:bg-white/90 transition-all active:scale-95 shadow-[0_8px_32px_rgba(255,255,255,0.15)] animate-in"
              style={{ animationDelay: "300ms" }}
            >
              Manage Build <ChevronRight size={15} />
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
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/[0.10]">
      {icon}
      <span className="text-xs font-bold text-white tabular">{children}</span>
    </div>
  );
}
