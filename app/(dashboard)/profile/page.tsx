"use client";

import { useState, useEffect } from "react";
import { User, Edit2, Check, X, LogOut, Car, Wrench, TrendingUp, Award, ChevronRight, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { calculateBuildScore, LEVELS, LEVEL_COLORS } from "@/lib/build-score";
import { computeBadges, type Badge, type BadgeInput, BADGE_ICON_PATHS } from "@/lib/badges";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

interface Stats {
  carCount: number;
  modCount: number;
  totalInvested: number;
  forumPosts: number;
}

function BadgeIcon({ icon, color, size = 14 }: { icon: string; color: string; size?: number }) {
  const path = BADGE_ICON_PATHS[icon];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <div
      className={`rounded-2xl border p-3.5 flex flex-col items-center gap-2.5 text-center transition-all ${
        badge.earned
          ? "border-[var(--color-border)] bg-[var(--color-bg-card)]"
          : "border-transparent bg-[rgba(255,255,255,0.02)] opacity-40"
      }`}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: badge.earned ? `${badge.color}15` : "rgba(255,255,255,0.04)" }}
      >
        <BadgeIcon icon={badge.icon} color={badge.earned ? badge.color : "#333"} size={17} />
      </div>
      <div>
        <p className={`text-[11px] font-bold leading-tight ${badge.earned ? "text-white" : "text-[var(--color-text-muted)]"}`}>
          {badge.name}
        </p>
        <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
          {badge.description}
        </p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ carCount: 0, modCount: 0, totalInvested: 0, forumPosts: 0 });
  const [buildScore, setBuildScore] = useState<ReturnType<typeof calculateBuildScore> | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<keyof Pick<Profile, "display_name" | "bio"> | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [showAllBadges, setShowAllBadges] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setEmail(user.email ?? null);

      const { data: profileData } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (profileData) setProfile(profileData as Profile);

      const { data: carsRaw } = await supabase
        .from("cars")
        .select("id, cover_image_url, horsepower, engine_size, specs_ai_guessed, is_public")
        .eq("user_id", user.id);

      const carList = (carsRaw ?? []) as Array<{
        id: string; cover_image_url: string | null; horsepower: number | null;
        engine_size: string | null; specs_ai_guessed: boolean; is_public: boolean;
      }>;
      const carIds = carList.map((c) => c.id);

      let allMods: { car_id: string; status: string; cost: number | null; install_date: string | null; notes: string | null }[] = [];

      if (carIds.length) {
        const { data: mods } = await supabase
          .from("mods")
          .select("car_id, cost, status, install_date, notes")
          .in("car_id", carIds);
        allMods = (mods ?? []) as typeof allMods;
      }

      const [postRes, replyRes] = await Promise.all([
        supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("forum_replies").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      const score = calculateBuildScore({
        cars: carList,
        mods: allMods,
        forumPostCount: postRes.count ?? 0,
        forumReplyCount: replyRes.count ?? 0,
      });

      const installedMods = allMods.filter((m) => m.status === "installed");
      const wishlistMods = allMods.filter((m) => m.status === "wishlist");

      const badgeInput: BadgeInput = {
        modCount: allMods.length,
        installedModCount: installedMods.length,
        wishlistCount: wishlistMods.length,
        carCount: carList.length,
        carsWithPhoto: carList.filter((c) => c.cover_image_url).length,
        carsWithSpecs: carList.filter((c) => (c.horsepower || c.engine_size) && !c.specs_ai_guessed).length,
        forumPostCount: postRes.count ?? 0,
        forumReplyCount: replyRes.count ?? 0,
        publicCarCount: carList.filter((c) => c.is_public).length,
        modsWithCost: installedMods.filter((m) => m.cost != null && m.cost > 0).length,
        modsWithNotes: installedMods.filter((m) => m.notes && m.notes.trim().length > 0).length,
        buildScore: score.score,
        buildLevel: score.level,
      };

      setBadges(computeBadges(badgeInput));

      const invested = installedMods.reduce((s, m) => s + (m.cost ?? 0), 0);
      setStats({ carCount: carIds.length, modCount: installedMods.length, totalInvested: invested, forumPosts: postRes.count ?? 0 });
      setBuildScore(score);
      setLoading(false);
    });
  }, [router]);

  async function saveField(field: keyof Pick<Profile, "display_name" | "bio">) {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: editValue || null })
      .eq("id", profile.id);
    if (!error) setProfile((prev) => prev ? { ...prev, [field]: editValue || null } : prev);
    setSaving(false);
    setEditingField(null);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="px-5 py-6 max-w-lg mx-auto space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-36 rounded-3xl" />)}
      </div>
    );
  }

  const levelColor = buildScore ? LEVEL_COLORS[buildScore.level] : "#555";
  const levelData = LEVELS.find((l) => l.name === buildScore?.level);
  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);
  const visibleBadges = showAllBadges ? badges : [...earnedBadges, ...lockedBadges].slice(0, 8);

  return (
    <div className="px-5 py-6 max-w-lg mx-auto space-y-4 pb-8 stagger-children">
      {/* ── Hero: Avatar + name ── */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 flex items-center gap-5">
        <div
          className="w-18 h-18 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #3B82F6, #60A5FA)", width: "72px", height: "72px" }}
        >
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
          ) : (
            <User size={28} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold truncate">{profile?.display_name || `@${profile?.username}`}</p>
          <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">@{profile?.username} · {email}</p>
          {buildScore && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full" style={{ background: levelColor }} />
              <span className="text-[11px] font-bold" style={{ color: levelColor }}>{buildScore.level}</span>
              {levelData && (
                <span className="text-[10px] text-[var(--color-text-muted)]">· {levelData.description}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Build Score — prominent ── */}
      {buildScore && (
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Build Score</p>
              <div className="flex items-baseline gap-2.5">
                <span className="text-4xl font-bold tabular-nums">{buildScore.score}</span>
                <Award size={16} style={{ color: levelColor }} className="mb-0.5" />
              </div>
            </div>
            <div
              className="px-4 py-2 rounded-full text-xs font-bold"
              style={{ background: `${levelColor}15`, color: levelColor, border: `1px solid ${levelColor}25` }}
            >
              {buildScore.level}
            </div>
          </div>

          {/* Level progression */}
          <div className="mb-5">
            <div className="flex justify-between mb-2">
              {LEVELS.map((l, i) => (
                <div
                  key={l.name}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i <= buildScore.levelIndex ? "opacity-100" : "opacity-20"
                  }`}
                  style={{ background: i <= buildScore.levelIndex ? l.color : "#333" }}
                  title={l.name}
                />
              ))}
            </div>
            <div className="score-bar">
              <div
                className="score-bar-fill"
                style={{
                  width: `${buildScore.progress}%`,
                  background: `linear-gradient(90deg, ${levelColor}, ${levelColor}bb)`,
                }}
              />
            </div>
            {buildScore.nextLevel ? (
              <div className="flex justify-between mt-2">
                <p className="text-[10px] text-[var(--color-text-muted)]">{buildScore.score} pts</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  <Target size={9} className="inline mr-0.5" />{buildScore.nextLevel} at {buildScore.nextThreshold} pts
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-[var(--color-text-muted)] mt-2 text-center">
                Maximum level reached — you are the build.
              </p>
            )}
          </div>

          {/* Score breakdown */}
          {buildScore.breakdown.length > 0 && (
            <div className="space-y-1.5 pt-4 border-t border-[var(--color-border)]">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5">How you earned it</p>
              {buildScore.breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--color-text-secondary)]">{item.label}</span>
                  <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">+{item.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: <Car size={13} />, label: "Cars", value: stats.carCount },
          { icon: <Wrench size={13} />, label: "Mods", value: stats.modCount },
          { icon: <TrendingUp size={13} />, label: "Invested", value: stats.totalInvested > 0 ? formatCurrency(stats.totalInvested) : "—", accent: true },
          { label: "Posts", value: stats.forumPosts },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3.5 text-center">
            <p className={`text-lg font-bold ${stat.accent ? "text-[#60A5FA]" : ""}`}>{stat.value}</p>
            <p className="text-[9px] uppercase font-semibold tracking-wider text-[var(--color-text-muted)] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Badges — 4 column grid ── */}
      {badges.length > 0 && (
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Badges</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {earnedBadges.length} of {badges.length} earned
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {visibleBadges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
          </div>
          {badges.length > 8 && (
            <button
              onClick={() => setShowAllBadges((v) => !v)}
              className="w-full mt-4 py-2.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer font-medium"
            >
              {showAllBadges ? "Show less" : `Show all ${badges.length} badges`}
            </button>
          )}
        </div>
      )}

      {/* ── Profile fields ── */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Profile Info</p>
        </div>
        {(["display_name", "bio"] as const).map((field) => {
          const labels = { display_name: "Display Name", bio: "Bio" };
          const placeholders = { display_name: "Your name...", bio: "Tell others about your builds..." };
          const isEditing = editingField === field;
          const value = profile?.[field];
          return (
            <div key={field} className="px-6 py-5 border-b border-[var(--color-border)] last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{labels[field]}</p>
                  {isEditing ? (
                    field === "bio" ? (
                      <textarea autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-accent)] px-4 py-3 text-sm outline-none resize-none text-white"
                        rows={3} placeholder={placeholders[field]} maxLength={500} />
                    ) : (
                      <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-accent)] px-4 py-3 text-sm outline-none text-white"
                        placeholder={placeholders[field]} maxLength={60} />
                    )
                  ) : (
                    <p className={`text-sm ${value ? "text-white" : "text-[var(--color-text-disabled)] italic"}`}>
                      {value || placeholders[field]}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1.5 mt-6">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveField(field)} disabled={saving}
                        className="w-8 h-8 rounded-xl bg-[var(--color-success-muted)] flex items-center justify-center hover:opacity-80 cursor-pointer">
                        <Check size={14} className="text-[var(--color-success)]" />
                      </button>
                      <button onClick={() => setEditingField(null)}
                        className="w-8 h-8 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center hover:opacity-80 cursor-pointer">
                        <X size={14} className="text-[var(--color-text-muted)]" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingField(field); setEditValue(value ?? ""); }}
                      className="w-8 h-8 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer">
                      <Edit2 size={12} className="text-[var(--color-text-muted)]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Links ── */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        {[
          { label: "My Garage", href: "/garage", icon: <Car size={15} /> },
          { label: "Forum", href: "/forum", icon: <Wrench size={15} /> },
        ].map((link) => (
          <a key={link.label} href={link.href}
            className="flex items-center gap-3.5 px-6 py-4 border-b border-[var(--color-border)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
            <span className="text-[var(--color-text-muted)]">{link.icon}</span>
            <span className="text-sm font-medium flex-1">{link.label}</span>
            <ChevronRight size={15} className="text-[var(--color-text-disabled)]" />
          </a>
        ))}
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3.5 px-6 py-4.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors cursor-pointer border-t border-[var(--color-border)]">
          <LogOut size={15} />
          Sign out
        </button>
      </div>

      <div className="h-6" />
    </div>
  );
}
