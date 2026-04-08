"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, Star, Flag, ShieldCheck, Swords, Trophy, Sparkles } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { formatRelativeDate } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

const TYPE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; color: string; label: string }> = {
  card_rated:      { icon: Star,       color: "#fbbf24", label: "New rating" },
  card_flagged:    { icon: Flag,       color: "#ff453a", label: "Card flagged" },
  card_endorsed:   { icon: ShieldCheck, color: "#30d158", label: "Card endorsed" },
  battle_result:   { icon: Swords,     color: "#a855f7", label: "Battle result" },
  battle_challenge:{ icon: Swords,     color: "#60a5fa", label: "Battle challenge" },
  achievement:     { icon: Trophy,     color: "#fbbf24", label: "Achievement" },
  generic:         { icon: Sparkles,   color: "#8a8a8a", label: "Update" },
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      setItems(json.notifications ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  return (
    <div className="min-h-dvh animate-fade">
      <PageContainer maxWidth="4xl" className="pt-10 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--color-accent-muted)]" style={{ border: "1px solid rgba(59,130,246,0.3)" }}>
              <Bell size={18} style={{ color: "var(--color-accent)" }} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">Notifications</h1>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {loading ? "Loading..." : `${items.filter((i) => !i.read).length} unread`}
              </p>
            </div>
          </div>
          {items.some((i) => !i.read) && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
            >
              <Check size={12} /> Mark all read
            </button>
          )}
        </div>

        {loading && <div className="text-[var(--color-text-muted)] text-sm">Loading...</div>}

        {!loading && items.length === 0 && (
          <div className="text-center py-20">
            <Bell size={32} className="mx-auto mb-4 text-[var(--color-text-muted)] opacity-30" />
            <p className="text-sm text-[var(--color-text-secondary)]">No notifications yet</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              You&rsquo;ll see battle results, new ratings, and flags here.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {items.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.generic;
            const Icon = meta.icon;
            const payload = n.payload ?? {};
            const cardId = typeof payload.card_id === "string" ? payload.card_id : null;
            const outcome = typeof payload.outcome === "string" ? payload.outcome : null;
            const weighted = typeof payload.weighted === "number" ? payload.weighted : null;
            const Container = cardId ? Link : "div";
            const containerProps = cardId ? { href: `/c/${cardId}` } : {};
            return (
              <li key={n.id}>
                <Container
                  {...(containerProps as { href: string })}
                  className="flex items-start gap-3 p-4 rounded-xl transition-colors"
                  style={{
                    background: n.read ? "var(--color-bg-card)" : "var(--mv-accent-tint)",
                    border: `1px solid ${n.read ? "var(--color-border)" : "var(--mv-panel-border-bright)"}`,
                    textDecoration: "none",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}55` }}
                  >
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{meta.label}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {formatRelativeDate(n.created_at)}
                      {outcome ? ` · ${outcome}` : ""}
                      {weighted != null ? ` · ${weighted.toFixed(2)}/5` : ""}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background: "var(--color-accent)" }} />
                  )}
                </Container>
              </li>
            );
          })}
        </ul>
      </PageContainer>
    </div>
  );
}
