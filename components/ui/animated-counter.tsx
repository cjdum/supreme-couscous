"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
  /** Start animation from this value (defaults to 0) */
  from?: number;
}

/**
 * Odometer-style number that rolls up to its target value.
 * Uses requestAnimationFrame for smooth animation.
 * Respects prefers-reduced-motion.
 */
export function AnimatedCounter({
  value,
  duration = 1400,
  format,
  className,
  prefix = "",
  suffix = "",
  from = 0,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState<number>(from);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(from);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Respect reduced motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    startTimeRef.current = null;
    startValueRef.current = display;

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startValueRef.current + (value - startValueRef.current) * eased;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const rendered = format ? format(display) : Math.round(display).toLocaleString();

  return (
    <span className={`tabular ${className ?? ""}`}>
      {prefix}{rendered}{suffix}
    </span>
  );
}
