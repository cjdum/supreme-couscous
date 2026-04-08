"use client";

import { useEffect, useState } from "react";
import { Trophy, Wrench, Users, Swords, Clock, Lock, Check } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";

interface Achievement {
  id: string;
  category: "builder" | "community" | "battle" | "platform";
  label: string;
  description: string;
  target: number;
  metric: string;
  progress: number;
  earned: boolean;
  earned_at: string | null;
}

const CATEGORY_META: Record<
  Achievement["category"],
  { label: string; icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; color: string }
> = {
  builder:   { label: "Builder",   icon: Wrench, color: "#3B82F6" },
  community: { label: "Community", icon: Users,  color: "#30d158" },
  battle:    { label: "Battle",    icon: Swords, color: "#ff453a" },
  platform:  { label: "Platform",  icon: Clock,  color: "#a855f7" },
};

export default function AchievementsPage() {
  const [list, setList] = useState<Achievement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/achievements");
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        setList(json.achievements as Achievement[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const earnedCount = list?.filter((a) => a.earned).length ?? 0;
  const total = list?.length ?? 0;

  const byCategory: Record<string, Achievement[]> = {};
  for (const a of list ?? []) {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  }

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="6xl" className="pt-10 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl" style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)" }}>
            <Trophy size={18} style={{ color: "#fbbf24" }} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">Achievements</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {loading ? "Loading..." : `${earnedCount} of ${total} unlocked`}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.3)", color: "#ff453a" }}>
            {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-4 h-32 animate-pulse" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }} />
            ))}
          </div>
        )}

        {!loading && list && (
          <div className="space-y-10">
            {(["builder", "community", "battle", "platform"] as const).map((cat) => {
              const items = byCategory[cat] ?? [];
              if (items.length === 0) return null;
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              const earnedHere = items.filter((i) => i.earned).length;
              return (
                <section key={cat}>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon size={16} className="flex-shrink-0" style={{ color: meta.color }} />
                    <h2 className="text-sm font-black tracking-[0.12em] uppercase text-[var(--color-text-primary)]">
                      {meta.label}
                    </h2>
                    <span className="text-[11px] text-[var(--color-text-muted)] font-mono ml-1">
                      {earnedHere}/{items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((a) => {
                      const pct = Math.min(100, Math.round((a.progress / a.target) * 100));
                      return (
                        <div
                          key={a.id}
                          className="rounded-2xl p-4 flex flex-col gap-3"
                          style={{
                            background: a.earned ? "var(--mv-accent-tint)" : "var(--color-bg-card)",
                            border: `1px solid ${a.earned ? meta.color + "55" : "var(--color-border)"}`,
                            opacity: a.earned ? 1 : 0.82,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-[var(--color-text-primary)]">{a.label}</p>
                              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{a.description}</p>
                            </div>
                            {a.earned ? (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: meta.color + "22", border: `1px solid ${meta.color}55` }}>
                                <Check size={14} style={{ color: meta.color }} />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                                <Lock size={12} className="text-[var(--color-text-muted)]" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-text-muted)] mb-1">
                              <span>{a.progress} / {a.target}</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-elevated)" }}>
                              <div
                                className="h-full transition-all"
                                style={{ width: `${pct}%`, background: a.earned ? meta.color : "var(--color-accent)" }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
