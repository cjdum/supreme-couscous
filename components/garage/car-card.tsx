"use client";

import Link from "next/link";
import { Globe, Lock, Wrench } from "lucide-react";
import type { Car } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/utils";

interface CarCardProps {
  car: Car;
  modCount?: number;
  totalSpent?: number;
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

export function CarCard({ car, modCount = 0, totalSpent = 0 }: CarCardProps) {
  const accent = getMakeColor(car.make);

  return (
    <Link
      href={`/garage/${car.id}`}
      className="block relative rounded-2xl overflow-hidden group card-hover border border-[var(--color-border)]"
      style={{ aspectRatio: "4/3" }}
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
          {/* Placeholder car silhouette */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 120 54"
              width="120"
              height="54"
              fill="none"
              aria-hidden="true"
              style={{ opacity: 0.08 }}
            >
              <path
                d="M12 42l9-24h78l9 24H12z"
                stroke="white"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M21 26l6-12h66l6 12H21z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="white"
                fillOpacity="0.04"
              />
              <ellipse cx="30" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
              <ellipse cx="90" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
              <path d="M22 32h76" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
            </svg>
          </div>
        </div>
      )}

      {/* Bottom-heavy gradient overlay — keeps text readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/25 to-black/5" />

      {/* Top-left: privacy badge */}
      <div className="absolute top-3 left-3">
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
          style={{
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            color: car.is_public ? "#22c55e" : "#71717a",
          }}
        >
          {car.is_public ? (
            <><Globe size={9} /> Public</>
          ) : (
            <><Lock size={9} /> Private</>
          )}
        </div>
      </div>

      {/* Top-right: make color accent dot */}
      {!car.cover_image_url && (
        <div
          className="absolute top-3 right-3 w-2 h-2 rounded-full opacity-70"
          style={{ backgroundColor: accent }}
        />
      )}

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {car.nickname && (
          <p
            className="text-[11px] font-semibold mb-0.5 truncate"
            style={{ color: accent === "#3b82f6" ? "#60a5fa" : accent }}
          >
            {car.nickname}
          </p>
        )}
        <h3 className="font-bold text-sm text-white truncate leading-snug">
          {car.year} {car.make} {car.model}
        </h3>
        {car.trim && (
          <p className="text-[11px] text-white/40 truncate mt-0.5">{car.trim}</p>
        )}

        <div className="flex items-center gap-3 mt-2.5">
          <span className="flex items-center gap-1 text-[11px] text-white/45">
            <Wrench size={9} />
            {modCount} {modCount === 1 ? "mod" : "mods"}
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
