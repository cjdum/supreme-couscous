"use client";

import { useState } from "react";
import {
  Car,
  Warehouse,
  Wrench,
  Layers,
  DollarSign,
  Flame,
  Zap,
  Camera,
  ShieldCheck,
  HardHat,
  GalleryHorizontal,
  Globe,
  MessageSquare,
  Lock,
  type LucideIcon,
} from "lucide-react";
import type { Milestone } from "@/lib/milestones";
import { TIER_COLORS } from "@/lib/milestones";

const ICON_MAP: Record<string, LucideIcon> = {
  Car,
  Warehouse,
  Wrench,
  Layers,
  DollarSign,
  Flame,
  Zap,
  Camera,
  ShieldCheck,
  HardHat,
  GalleryHorizontal,
  Globe,
  MessageSquare,
};

interface MilestonesGridProps {
  milestones: Milestone[];
}

type FilterMode = "all" | "earned" | "locked";

export function MilestonesGrid({ milestones }: MilestonesGridProps) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const earned = milestones.filter((m) => m.earned).length;
  const total = milestones.length;
  const pct = total ? Math.round((earned / total) * 100) : 0;

  const visible = milestones.filter((m) =>
    filter === "all" ? true : filter === "earned" ? m.earned : !m.earned,
  );

  return (
    <section className="mt-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-lg font-black tracking-tight text-[var(--color-text-primary)]">
            Milestones
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {earned} of {total} earned · {pct}%
          </p>
        </div>
        {/* Filter tabs */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{
            background: "var(--mv-panel-bg)",
            border: "1px solid var(--mv-panel-border)",
          }}
        >
          {(["all", "earned", "locked"] as const).map((mode) => {
            const active = filter === mode;
            return (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: active ? "var(--mv-panel-border)" : "transparent",
                  border: active ? "1px solid var(--mv-panel-border-bright)" : "1px solid transparent",
                  color: active ? "var(--mv-accent-text)" : "var(--mv-panel-text-muted)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 rounded-full overflow-hidden mb-6"
        style={{ background: "var(--mv-accent-tint)" }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #7b4fd4 0%, #a855f7 50%, #f5d76e 100%)",
            boxShadow: "0 0 12px rgba(168,85,247,0.5)",
            transition: "width 600ms ease",
          }}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map((m) => {
          const Icon = ICON_MAP[m.icon] ?? Wrench;
          const colors = TIER_COLORS[m.tier];
          return (
            <div
              key={m.id}
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{
                background: m.earned ? colors.bg : "var(--mv-panel-bg)",
                border: `1px solid ${m.earned ? colors.border : "var(--mv-panel-border)"}`,
                boxShadow: m.earned ? `0 0 18px ${colors.glow}` : "none",
                opacity: m.earned ? 1 : 0.7,
              }}
            >
              {/* Icon + tier pill */}
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: m.earned ? `${colors.bg}` : "var(--mv-panel-bg)",
                    border: `1px solid ${m.earned ? colors.border : "var(--mv-panel-border)"}`,
                  }}
                >
                  {m.earned ? (
                    <Icon size={18} style={{ color: colors.text }} />
                  ) : (
                    <Lock size={14} style={{ color: "var(--mv-panel-text-dim)" }} />
                  )}
                </div>
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 7,
                    fontWeight: 900,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: m.earned ? colors.bg : "rgba(15,12,30,0.6)",
                    border: `1px solid ${m.earned ? colors.border : "var(--mv-panel-border)"}`,
                    color: m.earned ? colors.text : "var(--mv-panel-text-dim)",
                  }}
                >
                  {m.tier}
                </span>
              </div>

              {/* Text */}
              <p
                className="text-[13px] font-black leading-tight mb-1"
                style={{
                  color: m.earned ? "#fff" : "var(--mv-panel-text-soft)",
                }}
              >
                {m.title}
              </p>
              <p
                className="text-[10px] leading-snug"
                style={{
                  color: "var(--mv-panel-text-muted)",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.02em",
                }}
              >
                {m.description}
              </p>

              {/* Progress mini-bar for unearned */}
              {!m.earned && m.progress != null && m.progress > 0 && (
                <div
                  className="mt-3 h-1 rounded-full overflow-hidden"
                  style={{ background: "var(--mv-accent-tint)" }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, m.progress * 100)}%`,
                      height: "100%",
                      background: "var(--mv-panel-border-bright)",
                      transition: "width 400ms ease",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            color: "rgba(200,180,240,0.4)",
            letterSpacing: "0.1em",
          }}
        >
          No milestones in this filter.
        </div>
      )}
    </section>
  );
}
