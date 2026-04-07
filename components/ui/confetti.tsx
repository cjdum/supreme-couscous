"use client";

import { useEffect, useState } from "react";

interface ConfettiBurstProps {
  /** Set to a unique number/key to trigger; null = inactive */
  trigger: number | null;
  count?: number;
  duration?: number;
}

const COLORS = ["#3B82F6", "#60A5FA", "#fbbf24", "#30d158", "#ff453a", "#bf5af2", "#ff9f0a"];

/**
 * One-shot confetti burst. Increment `trigger` to fire.
 * Renders 60 colored particles that fall and rotate.
 */
export function ConfettiBurst({ trigger, count = 60, duration = 2400 }: ConfettiBurstProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; cx: number; cy: number; color: string; size: number; delay: number; shape: "circle" | "square" }[]>([]);

  useEffect(() => {
    if (trigger === null) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const newParticles = Array.from({ length: count }, (_, i) => {
      const angle = (Math.random() - 0.5) * Math.PI; // -90deg to +90deg
      const velocity = 200 + Math.random() * 400;
      const cx = Math.cos(angle) * velocity * (Math.random() > 0.5 ? 1 : -1);
      const cy = (50 + Math.random() * 80) * 8;
      const shape: "circle" | "square" = Math.random() > 0.5 ? "circle" : "square";
      return {
        id: i + (trigger ?? 0) * 1000,
        x: 50 + (Math.random() - 0.5) * 20,
        y: 35 + (Math.random() - 0.5) * 10,
        cx,
        cy,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        delay: Math.random() * 200,
        shape,
      };
    });

    setParticles(newParticles);
    const t = setTimeout(() => setParticles([]), duration);
    return () => clearTimeout(t);
  }, [trigger, count, duration]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[80] overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            animation: `confettiFall ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}ms forwards`,
            // @ts-expect-error custom CSS vars
            "--cx": `${p.cx}px`,
            "--cy": `${p.cy}px`,
          }}
        />
      ))}
    </div>
  );
}
