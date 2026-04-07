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
      className={`rounded-[14px] border p-3 flex flex-col items-center gap-2 text-center transition-all ${
        badge.earned
          ? "border-[rgba(255,255,255,0.1)] bg-[#111111]"
          : "border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] opacity-45"
      }`}
    >
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center"
        style={{ background: badge.earned ? `${badge.color}18` : "rgba(255,255,255,0.04)" }}
      >
        <BadgeIcon icon={badge.icon} color={badge.earned ? badge.color : "rgba(255,255,255,0.2)"} size={16} />
      </div>
      <div>
        <p className={`text-[11px] font-bold leading-tight ${badge.earned ? "text-white" : "text-[rgba(255,255,255,0.3)]"}`}>
          {badge.name}
        </p>
        <p className="text-[9px] text-[rgba(255,255,255,0.25)] mt-0.5 leading-tight">
          {badge.description}
        </p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ carCount: 0, modCount: 0, totalInvested: 0 });
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
      setStats({ carCount: carIds.length, modCount: installedMods.length, totalInvested: invested });
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
      <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-[22px]" />)}
      </div>
    );
  }

  const levelColor = buildScore ? LEVEL_COLORS[buildScore.level] : "rgba(255,255,255,0.3)";
  const levelData = LEVELS.find((l) => l.name === buildScore?.level);
  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);
  const visibleBadges = showAllBadges ? badges : [...earnedBadges, ...lockedBadges].slice(0, 8);

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-3 pb-8">
      {/* Avatar + name */}
      <div className="rounded-[22px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-5 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #3B82F6, #60A5FA)" }}
        >
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          ) : (
            <User size={26} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold truncate">{profile?.display_name || `@${profile?.username}`}</p>
          <p className="text-xs text-[rgba(255,255,255,0.3)] truncate">@{profile?.username} · {email}</p>
          {buildScore && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: levelColor }} />
              <span className="text-[11px] font-semibold" style={{ color: levelColor }}>{buildScore.level}</span>
              {levelData && (
                <span className="text-[10px] text-[rgba(255,255,255,0.25)]">· {levelData.description}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Build Score */}
      {buildScore && (
        <div className="rounded-[22px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider mb-1.5">Build Score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{buildScore.score}</span>
                <Award size={15} style={{ color: levelColor }} className="mb-0.5" />
              </div>
            </div>
            <div
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: `${levelColor}18`, color: levelColor, border: `1px solid ${levelColor}30` }}
            >
              {buildScore.level}
            </div>
          </div>

          {/* Level progression */}
          <div className="mb-4">
            {/* Level names bar */}
            <div className="flex justify-between mb-1.5">
              {LEVELS.map((l, i) => (
                <div
                  key={l.name}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i <= buildScore.levelIndex ? "opacity-100" : "opacity-20"
                  }`}
                  style={{ background: i <= buildScore.levelIndex ? l.color : "rgba(255,255,255,0.2)" }}
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
              <div className="flex justify-between mt-1.5">
                <p className="text-[10px] text-[rgba(255,255,255,0.28)]">{buildScore.score} pts</p>
                <p className="text-[10px] text-[rgba(255,255,255,0.28)]">
                  <Target size={9} className="inline mr-0.5" />{buildScore.nextLevel} at {buildScore.nextThreshold} pts
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-1.5 text-center">
                Maximum level reached — you are the build.
              </p>
            )}
          </div>

          {/* Score breakdown */}
          {buildScore.breakdown.length > 0 && (
            <div className="space-y-1 pt-3 border-t border-[rgba(255,255,255,0.05)]">
              <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.25)] uppercase tracking-wider mb-2">How you earned it</p>
              {buildScore.breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[11px] text-[rgba(255,255,255,0.4)]">{item.label}</span>
                  <span className="text-[11px] font-semibold text-[rgba(255,255,255,0.55)]">+{item.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: <Car size={12} />, label: "Vehicles", value: stats.carCount },
          { icon: <Wrench size={12} />, label: "Mods", value: stats.modCount },
          { icon: <TrendingUp size={12} />, label: "Invested", value: stats.totalInvested > 0 ? formatCurrency(stats.totalInvested) : "—", accent: true },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-3.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1 text-[rgba(255,255,255,0.25)]">
              {stat.icon}
              <span className="text-[9px] uppercase font-semibold tracking-wider">{stat.label}</span>
            </div>
            <p className={`text-xl font-bold ${stat.accent ? "text-[#60A5FA]" : ""}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="rounded-[22px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider">Badges</p>
              <p className="text-xs text-[rgba(255,255,255,0.4)] mt-0.5">
                {earnedBadges.length} of {badges.length} earned
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {visibleBadges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
          </div>
          {badges.length > 8 && (
            <button
              onClick={() => setShowAllBadges((v) => !v)}
              className="w-full mt-3 py-2 text-xs text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.6)] transition-colors cursor-pointer"
            >
              {showAllBadges ? "Show less" : `Show all ${badges.length} badges`}
            </button>
          )}
        </div>
      )}

      {/* Profile fields */}
      <div className="rounded-[22px] border border-[rgba(255,255,255,0.07)] bg-[#111111] overflow-hidden">
        <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.05)]">
          <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider">Profile Info</p>
        </div>
        {(["display_name", "bio"] as const).map((field) => {
          const labels = { display_name: "Display Name", bio: "Bio" };
          const placeholders = { display_name: "Your name…", bio: "Tell others about your builds…" };
          const isEditing = editingField === field;
          const value = profile?.[field];
          return (
            <div key={field} className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)] last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider mb-1.5">{labels[field]}</p>
                  {isEditing ? (
                    field === "bio" ? (
                      <textarea autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-[#1a1a1a] rounded-[8px] border border-[#3B82F6] px-3 py-2 text-sm outline-none resize-none text-white"
                        rows={3} placeholder={placeholders[field]} maxLength={500} />
                    ) : (
                      <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-[#1a1a1a] rounded-[8px] border border-[#3B82F6] px-3 py-2 text-sm outline-none text-white"
                        placeholder={placeholders[field]} maxLength={60} />
                    )
                  ) : (
                    <p className={`text-sm ${value ? "text-white" : "text-[rgba(255,255,255,0.2)] italic"}`}>
                      {value || placeholders[field]}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1 mt-5">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveField(field)} disabled={saving}
                        className="w-7 h-7 rounded-lg bg-[rgba(34,197,94,0.1)] flex items-center justify-center hover:opacity-80 cursor-pointer">
                        <Check size={13} className="text-[#22c55e]" />
                      </button>
                      <button onClick={() => setEditingField(null)}
                        className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center hover:opacity-80 cursor-pointer">
                        <X size={13} className="text-[rgba(255,255,255,0.35)]" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingField(field); setEditValue(value ?? ""); }}
                      className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center hover:border hover:border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer">
                      <Edit2 size={11} className="text-[rgba(255,255,255,0.28)]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Links */}
      <div className="rounded-[22px] border border-[rgba(255,255,255,0.07)] bg-[#111111] overflow-hidden">
        {[
          { label: "My Garage", href: "/garage", icon: <Car size={14} /> },
          { label: "Forum", href: "/forum", icon: <Wrench size={14} /> },
        ].map((link) => (
          <a key={link.label} href={link.href}
            className="flex items-center gap-3 px-5 py-3.5 border-b border-[rgba(255,255,255,0.05)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
            <span className="text-[rgba(255,255,255,0.3)]">{link.icon}</span>
            <span className="text-sm font-medium flex-1">{link.label}</span>
            <ChevronRight size={14} className="text-[rgba(255,255,255,0.18)]" />
          </a>
        ))}
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-[#ef4444] hover:bg-[rgba(239,68,68,0.05)] transition-colors cursor-pointer">
          <LogOut size={14} />
          Sign out
        </button>
      </div>

      <div className="h-6" />
    </div>
  );
}
