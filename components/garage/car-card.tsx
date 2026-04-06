"use client";

import Link from "next/link";
import { Globe, Lock, ChevronRight, Wrench } from "lucide-react";
import type { Car } from "@/lib/supabase/types";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";

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
  audi: "#555",
  toyota: "#eb0a1e",
  honda: "#cc0000",
  subaru: "#003399",
  nissan: "#1a1a1a",
  ford: "#003476",
  chevrolet: "#d4a017",
};

function getMakeColor(make: string): string {
  return MAKE_COLORS[make.toLowerCase()] ?? "#3b82f6";
}

export function CarCard({ car, modCount = 0, totalSpent = 0 }: CarCardProps) {
  const makeColor = getMakeColor(car.make);

  return (
    <Link
      href={`/garage/${car.id}`}
      className="block rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden card-hover group"
    >
      {/* Color band */}
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: makeColor, opacity: 0.8 }}
      />

      {/* Cover image or placeholder */}
      <div className="relative h-40 bg-[var(--color-bg-elevated)] overflow-hidden">
        {car.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={car.cover_image_url}
            alt={`${car.year} ${car.make} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 80 36"
              width="80"
              height="36"
              fill="none"
              aria-hidden="true"
              style={{ opacity: 0.15 }}
            >
              <path
                d="M8 28l6-16h52l6 16H8z"
                stroke="white"
                strokeWidth="2"
                strokeLinejoin="round"
                fill="none"
              />
              <ellipse cx="20" cy="29" rx="4" ry="4" stroke="white" strokeWidth="2" />
              <ellipse cx="60" cy="29" rx="4" ry="4" stroke="white" strokeWidth="2" />
              <path d="M14 20h52" stroke="white" strokeWidth="1" strokeDasharray="3 3" />
            </svg>
          </div>
        )}

        {/* Public/private badge */}
        <div className="absolute top-2 right-2">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
            style={{
              backgroundColor: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              color: car.is_public ? "#22c55e" : "#a1a1aa",
            }}
          >
            {car.is_public ? (
              <>
                <Globe size={10} /> Public
              </>
            ) : (
              <>
                <Lock size={10} /> Private
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {car.nickname && (
              <p className="text-xs text-[var(--color-text-muted)] truncate mb-0.5">{car.nickname}</p>
            )}
            <h3 className="font-semibold text-sm truncate">
              {car.year} {car.make} {car.model}
            </h3>
            {car.trim && (
              <p className="text-xs text-[var(--color-text-secondary)] truncate">{car.trim}</p>
            )}
          </div>
          <ChevronRight
            size={16}
            className="text-[var(--color-text-muted)] shrink-0 mt-0.5 group-hover:text-[var(--color-accent)] transition-colors"
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <Wrench size={12} className="text-[var(--color-text-muted)]" />
            <span>{modCount} mod{modCount !== 1 ? "s" : ""}</span>
          </div>
          {totalSpent > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[var(--color-text-muted)]">Invested:</span>
              <span className="font-medium text-[var(--color-accent-bright)]">
                {formatCurrency(totalSpent)}
              </span>
            </div>
          )}
          <div className="ml-auto text-[10px] text-[var(--color-text-muted)]">
            {formatRelativeDate(car.created_at)}
          </div>
        </div>
      </div>
    </Link>
  );
}
