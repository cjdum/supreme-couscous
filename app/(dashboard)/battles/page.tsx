"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Trophy, TrendingUp, Zap } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";

interface Battle {
  id: string;
  challenger_card_id: string;
  defender_card_id: string;
  winner_card_id: string | null;
  challenger_score: number;
  defender_score: number;
  battled_at: string;
  challenger_title: string | null;
  defender_title: string | null;
  challenger_username: string | null;
  defender_username: string | null;
}

export default function BattlesPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/battles/recent")
      .then((r) => r.json())
      .then((j) => setBattles(j.battles ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="2xl" className="pt-10 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Swords size={20} style={{ color: "#ef4444" }} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">Battles</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Cards compete head-to-head on build specs.
            </p>
          </div>
        </div>

        {/* How battles work — minimal callout */}
        <div
          style={{
            padding: "14px 18px", borderRadius: 14,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
            marginBottom: 28,
          }}
        >
          <div className="flex items-start gap-3">
            <Zap size={14} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-xs font-bold text-[var(--color-text-primary)]">How it works</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
                Open any card and tap <strong style={{ color: "var(--color-text-secondary)" }}>Challenge</strong> to battle another build.
                Scores factor in HP, mods, investment, and build score. Cooldown: 24h per card.
              </p>
            </div>
          </div>
        </div>

        {/* Battle history */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  height: 72, borderRadius: 14,
                  background: "var(--color-bg-card)", border: "1px solid var(--color-border)",
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        ) : battles.length === 0 ? (
          <div
            style={{
              padding: "60px 24px", textAlign: "center",
              borderRadius: 16,
              background: "var(--color-bg-card)", border: "1px solid var(--color-border)",
            }}
          >
            <Swords size={32} style={{ color: "var(--color-text-muted)", opacity: 0.3, margin: "0 auto 12px" }} />
            <p
              style={{
                fontFamily: "ui-monospace, monospace", fontSize: 12,
                color: "var(--color-text-muted)", letterSpacing: "0.06em",
              }}
            >
              No battles yet
            </p>
            <p
              style={{
                fontFamily: "ui-monospace, monospace", fontSize: 10,
                color: "var(--color-text-muted)", opacity: 0.5, marginTop: 6,
              }}
            >
              Open a card and challenge someone to start.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {battles.map((b) => {
              const challWon = b.winner_card_id === b.challenger_card_id;
              const defWon   = b.winner_card_id === b.defender_card_id;
              const tie      = !b.winner_card_id;
              const date     = new Date(b.battled_at).toLocaleDateString(undefined, {
                month: "short", day: "numeric",
              });

              return (
                <div
                  key={b.id}
                  style={{
                    padding: "14px 16px", borderRadius: 14,
                    background: "var(--color-bg-card)", border: "1px solid var(--color-border)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  {/* Challenger */}
                  <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                    <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                      {b.challenger_title ?? "Unnamed Card"}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                      @{b.challenger_username ?? "—"}
                    </p>
                  </div>

                  {/* Score */}
                  <div style={{ flexShrink: 0, textAlign: "center", minWidth: 80 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 900,
                          color: challWon ? "#30d158" : defWon ? "rgba(200,180,240,0.4)" : "var(--color-text-muted)",
                        }}
                      >
                        {Math.round(b.challenger_score)}
                      </span>
                      <Swords size={12} style={{ color: "rgba(239,68,68,0.5)" }} />
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 900,
                          color: defWon ? "#30d158" : challWon ? "rgba(200,180,240,0.4)" : "var(--color-text-muted)",
                        }}
                      >
                        {Math.round(b.defender_score)}
                      </span>
                    </div>
                    <p style={{ fontSize: 9, color: "var(--color-text-muted)", marginTop: 2 }}>{date}</p>
                    {tie && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 2 }}>
                        <TrendingUp size={9} style={{ color: "#fbbf24" }} />
                        <span style={{ fontSize: 9, color: "#fbbf24", fontWeight: 700 }}>TIE</span>
                      </div>
                    )}
                    {!tie && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 2 }}>
                        <Trophy size={9} style={{ color: "#30d158" }} />
                        <span style={{ fontSize: 9, color: "#30d158", fontWeight: 700 }}>
                          {challWon ? b.challenger_username : b.defender_username} wins
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Defender */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                      {b.defender_title ?? "Unnamed Card"}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                      @{b.defender_username ?? "—"}
                    </p>
                  </div>

                  {/* View link */}
                  <Link
                    href={`/c/${b.challenger_card_id}`}
                    style={{
                      fontSize: 10, fontWeight: 700, color: "rgba(168,85,247,0.7)",
                      flexShrink: 0, textDecoration: "none",
                      fontFamily: "ui-monospace, monospace", letterSpacing: "0.04em",
                    }}
                  >
                    View →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
