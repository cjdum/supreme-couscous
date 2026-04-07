"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
}

/**
 * Reusable toggle switch with a perfectly centred thumb.
 *
 * Track and thumb are sized in pixels and the thumb is centred with
 * top: 50% / translate-y-(-50%) so it stays vertically aligned in any
 * parent layout — fixing the off-centre rendering bug across the app.
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = "md",
  ariaLabel,
  className,
}: ToggleProps) {
  const trackW = size === "sm" ? 36 : 44;
  const trackH = size === "sm" ? 20 : 24;
  const thumbSize = size === "sm" ? 14 : 18;
  const padding = (trackH - thumbSize) / 2;
  const translateOn = trackW - thumbSize - padding;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
        checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-hover)]",
        className
      )}
      style={{ width: `${trackW}px`, height: `${trackH}px` }}
    >
      <span
        aria-hidden="true"
        className="absolute rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-transform duration-200 ease-out"
        style={{
          width: `${thumbSize}px`,
          height: `${thumbSize}px`,
          top: "50%",
          left: `${padding}px`,
          transform: `translate3d(${checked ? translateOn - padding : 0}px, -50%, 0)`,
        }}
      />
    </button>
  );
}
