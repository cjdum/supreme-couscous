"use client";

import Link from "next/link";
import { Globe, Lock, Wrench, Star } from "lucide-react";
import type { Car } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/utils";
import { SetPrimaryButton } from "./set-primary-button";

interface CarCardProps {
  car: Car;
  modCount?: number;
  totalSpent?: number;
  isPrimary?: boolean;
  compact?: boolean;
}

const MAKE_COLORS: Record<string, string> = {
  porsche: "#a8252b",
  bmw: "#1c69d3",
  mercedes: "#00adef",
  ferrari: "#cc0000",
  lamborghini: "#f5a623",
  audi: "#888888",
  toyota: "#eb0a1e",
  honda: "#cc0000",
  subaru: "#003399",
  nissan: "#444444",
  ford: "#003476",
  chevrolet: "#d4a017",
};

function getMakeColor(make: string): string {
  return MAKE_COLORS[make.toLowerCase()] ?? "#3b82f6";
}

export function CarCard({ car, modCount = 0, totalSpent = 0, isPrimary = false, compact = false }: CarCardProps) {
  const accent = getMakeColor(car.make);

  return (
    <Link
      href={`/garage/${car.id}`}
      className="block relative rounded-2xl overflow-hidden group card-hover border border-[var(--color-border)]"
      style={{ aspectRatio: compact ? "3/4" : "4/3" }}
    >
      {/* Background: photo or brand-tinted gradient */}
      {car.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={car.cover_image_url}
          alt={`${car.year} ${car.make} ${car.model}`}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 25% 40%, ${accent}33 0%, transparent 65%),
                         linear-gradient(160deg, ${accent}1a 0%, #09090b 60%)`,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 120 54"
              width={compact ? "80" : "120"}
              height={compact ? "36" : "54"}
              fill="none"
              aria-hidden="true"
              style={{ opacity: 0.06 }}
            >
              <path d="M12 42l9-24h78l9 24H12z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M21 26l6-12h66l6 12H21z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="white" fillOpacity="0.04" />
              <ellipse cx="30" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
              <ellipse cx="90" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
            </svg>
          </div>
        </div>
      )}

      {/* Bottom-heavy gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/5" />

      {/* Top-left: primary badge or privacy badge */}
      <div className="absolute top-3 left-3 flex flex-col gap-1">
        {isPrimary ? (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
            style={{
              backgroundColor: "rgba(251,191,36,0.12)",
              backdropFilter: "blur(8px)",
              color: "#fbbf24",
              border: "1px solid rgba(251,191,36,0.20)",
            }}
          >
            <Star size={9} fill="currentColor" /> Primary
          </div>
        ) : (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium"
            style={{
              backgroundColor: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(8px)",
              color: car.is_public ? "#30d158" : "#555",
            }}
          >
            {car.is_public ? (
              <><Globe size={9} /> Public</>
            ) : (
              <><Lock size={9} /> Private</>
            )}
          </div>
        )}
      </div>

      {/* Top-right: set primary button */}
      {!isPrimary && !compact && (
        <div className="absolute top-3 right-3">
          <SetPrimaryButton carId={car.id} />
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-3.5">
        {car.nickname && (
          <p
            className="text-[10px] font-semibold mb-0.5 truncate"
            style={{ color: accent === "#3b82f6" ? "#60a5fa" : accent }}
          >
            {car.nickname}
          </p>
        )}
        <h3 className={`font-bold text-white truncate leading-snug ${compact ? "text-xs" : "text-sm"}`}>
          {car.year} {car.make} {car.model}
        </h3>
        {car.trim && !compact && (
          <p className="text-[11px] text-white/35 truncate mt-0.5">{car.trim}</p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-[11px] text-white/45">
            <Wrench size={9} />
            {modCount}
          </span>
          {totalSpent > 0 && (
            <span className="text-[11px] font-bold text-[var(--color-accent-bright)]">
              {formatCurrency(totalSpent)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
