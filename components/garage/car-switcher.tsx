"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Car } from "@/lib/supabase/types";

interface CarSwitcherProps {
  cars: Car[];
}

export function CarSwitcher({ cars }: CarSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);

  const nonPrimary = cars.filter((c) => !c.is_primary);
  if (nonPrimary.length === 0) return null;

  async function handleSwitch(carId: string) {
    setSwitching(carId);
    try {
      await fetch("/api/cars/set-primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId }),
      });
      router.refresh();
    } catch {
      setSwitching(null);
    }
  }

  return (
    <section className="mt-8 max-w-3xl mx-auto">
      <p
        className="text-[10px] font-bold uppercase mb-3 px-1"
        style={{
          letterSpacing: "0.18em",
          color: "var(--color-text-muted)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        Other Cars
      </p>
      <div className="flex flex-col gap-2">
        {nonPrimary.map((car) => (
          <div
            key={car.id}
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            {car.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={car.cover_image_url}
                alt={`${car.year} ${car.make} ${car.model}`}
                className="w-16 h-12 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-16 h-12 rounded-xl flex-shrink-0"
                style={{ background: "var(--color-bg-elevated)" }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                {car.year} {car.make} {car.model}
              </p>
              {car.nickname && (
                <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                  {car.nickname}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleSwitch(car.id)}
              disabled={switching === car.id}
              className="flex-shrink-0 min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background:
                  switching === car.id
                    ? "rgba(168,85,247,0.06)"
                    : "rgba(168,85,247,0.12)",
                border: "1px solid rgba(168,85,247,0.3)",
                color: "var(--color-accent-bright)",
                cursor: switching === car.id ? "wait" : "pointer",
                opacity: switching === car.id ? 0.6 : 1,
              }}
            >
              {switching === car.id ? "Switching…" : "Set Active"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
