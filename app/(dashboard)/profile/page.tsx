"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { User, Edit2, Check, X, LogOut, Car, Wrench, TrendingUp, Award, ChevronRight, Target, Share2, Copy, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { calculateBuildScore, LEVELS, LEVEL_COLORS, BUILD_SCORE_COLOR, COMMUNITY_SCORE_COLOR, VAULT_RATING_COLOR } from "@/lib/build-score";
import { computeBadges, type Badge, type BadgeInput, BADGE_ICON_PATHS } from "@/lib/badges";
import { AWARDS, AWARDS_BY_ID, RARITY_STYLES, type AwardDef } from "@/lib/awards";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { ConfettiBurst } from "@/components/ui/confetti";
import { CarShareCard } from "@/components/garage/car-share-card";
import { haptic } from "@/lib/haptics";
import type { Car as CarType, ModCategory } from "@/lib/supabase/types";

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

const SEEN_BADGES_KEY = "modvault.seenBadges.v1";
const LAST_LEVEL_KEY = "modvault.lastLevel.v1";

function BadgeIcon({ icon, color, size = 14 }: { icon: string; color: string; size?: number }) {
  const path = BADGE_ICON_PATHS[icon];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function BadgeCard({ badge, isNew }: { badge: Badge; isNew?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-3.5 flex flex-col items-center gap-2.5 text-center transition-all relative ${
        badge.earned
          ? "border-[var(--color-border)] bg-[var(--color-bg-card)]"
          : "border-transparent bg-[rgba(255,255,255,0.02)] opacity-40"
      }`}
      style={isNew ? { animation: "badgeUnlock 800ms cubic-bezier(0.16, 1, 0.3, 1) both" } : undefined}
    >
      {isNew && (
        <span
          className="absolute -top-1.5 -right-1.5 text-[8px] font-black uppercase tracking-wider text-black bg-[var(--color-warning)] px-1.5 py-0.5 rounded-full glow-gold"
          style={{ animation: "scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: "400ms" }}
        >
          NEW
        </span>
      )}
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
        <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5 leading-tight">{badge.description}</p>
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
  const [newBadgeIds, setNewBadgeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<keyof Pick<Profile, "display_name" | "bio"> | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [primaryCar, setPrimaryCar] = useState<CarType | null>(null);
  const [unlockedAwards, setUnlockedAwards] = useState<Set<string>>(new Set());
  const [topCategory, setTopCategory] = useState<ModCategory | null>(null);
  const [topMods, setTopMods] = useState<{ name: string; category: ModCategory; cost: number | null }[]>([]);
  const [copied, setCopied] = useState(false);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? null);

      const { data: profileData } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (profileData) setProfile(profileData as Profile);

      const { data: carsRaw } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", user.id);

      const carList = (carsRaw ?? []) as CarType[];
      const carIds = carList.map((c) => c.id);
      const primary = carList.find((c) => c.is_primary) ?? carList[0] ?? null;
      setPrimaryCar(primary);

      let allMods: { car_id: string; name: string; category: ModCategory; status: string; cost: number | null; install_date: string | null; notes: string | null }[] = [];

      if (carIds.length) {
        const { data: mods } = await supabase
          .from("mods")
          .select("car_id, name, category, cost, status, install_date, notes")
          .in("car_id", carIds);
        allMods = (mods ?? []) as typeof allMods;
      }

      const [postRes, replyRes, awardsRes] = await Promise.all([
        supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("forum_replies").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("user_awards").select("award_id").eq("user_id", user.id),
      ]);
      const awardRows = (awardsRes.data ?? []) as { award_id: string }[];
      setUnlockedAwards(new Set(awardRows.map((r) => r.award_id)));

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

      const computedBadges = computeBadges(badgeInput);
      setBadges(computedBadges);

      // Detect newly earned badges
      try {
        const seenRaw = localStorage.getItem(SEEN_BADGES_KEY);
        const seen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
        const earned = computedBadges.filter((b) => b.earned).map((b) => b.id);
        const newOnes = earned.filter((id) => !seen.includes(id));
        if (newOnes.length > 0) {
          setNewBadgeIds(new Set(newOnes));
          localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(earned));
        }
      } catch {
        // ignore
      }

      // Detect level up
      if (!initialLoadRef.current) {
        try {
          const lastLevel = localStorage.getItem(LAST_LEVEL_KEY);
          if (lastLevel && lastLevel !== score.level) {
            const oldIdx = LEVELS.findIndex((l) => l.name === lastLevel);
            const newIdx = LEVELS.findIndex((l) => l.name === score.level);
            if (newIdx > oldIdx && newIdx >= 0) {
              setConfettiTrigger(Date.now());
              haptic("success");
            }
          }
          localStorage.setItem(LAST_LEVEL_KEY, score.level);
        } catch {
          // ignore
        }
        initialLoadRef.current = true;
      }

      // Compute top category & top mods for share card
      const primaryMods = primary ? installedMods.filter((m) => m.car_id === primary.id) : [];
      const catTotals = primaryMods.reduce<Record<string, number>>((acc, m) => {
        acc[m.category] = (acc[m.category] ?? 0) + (m.cost ?? 0);
        return acc;
      }, {});
      const topCatEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
      setTopCategory((topCatEntry?.[0] as ModCategory | undefined) ?? null);
      setTopMods(
        [...primaryMods]
          .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
          .slice(0, 3)
          .map((m) => ({ name: m.name, category: m.category, cost: m.cost }))
      );

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
    if (!error) setProfile((prev) => (prev ? { ...prev, [field]: editValue || null } : prev));
    setSaving(false);
    setEditingField(null);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function copyPublicUrl() {
    const url = `${window.location.origin}/u/${profile?.username}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    haptic("light");
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="px-5 py-6 max-w-2xl mx-auto space-y-3">
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
    <div className="px-5 sm:px-8 py-6 max-w-2xl mx-auto space-y-4 pb-8 stagger-children">
      <ConfettiBurst trigger={confettiTrigger} />

      {/* Hero: Avatar + name + Share */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 flex items-center gap-5">
        <div
          className="rounded-2xl flex items-center justify-center flex-shrink-0 glow-accent-sm"
          style={{ background: "linear-gradient(135deg, #3B82F6, #60A5FA)", width: "76px", height: "76px" }}
        >
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
          ) : (
            <span className="text-2xl font-black text-white">{profile?.username?.[0]?.toUpperCase() ?? "?"}</span>
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
        <button
          onClick={() => setSharing(true)}
          className="hidden sm:flex items-center gap-2 h-10 px-4 rounded-2xl bg-[var(--color-accent)] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer flex-shrink-0"
          aria-label="Share build"
        >
          <Share2 size={13} />
          Share
        </button>
      </div>

      {/* Public profile URL */}
      {profile?.username && (
        <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-muted)] flex items-center justify-center flex-shrink-0">
            <Sparkles size={14} className="text-[var(--color-accent-bright)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">Public Profile</p>
            <p className="text-xs font-mono text-white truncate">/u/{profile.username}</p>
          </div>
          <button
            onClick={copyPublicUrl}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[11px] font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] hover:text-white transition-colors cursor-pointer"
          >
            {copied ? <Check size={12} className="text-[var(--color-success)]" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {/* Builder Score — the new credibility metric */}
      <BuilderScoreWidget />

      {/* VAULT Rating — the combined, prominent card */}
      {buildScore && (
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: VAULT_RATING_COLOR }}>
                VAULT Rating
              </p>
              <div className="flex items-baseline gap-2.5">
                <span className="text-6xl font-black display-num" style={{ color: VAULT_RATING_COLOR }}>
                  <AnimatedCounter value={buildScore.score} duration={2000} />
                </span>
                <Award size={18} style={{ color: VAULT_RATING_COLOR }} className="mb-1" />
              </div>
            </div>
            <div
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ background: `${levelColor}15`, color: levelColor, border: `1px solid ${levelColor}25` }}
            >
              {buildScore.level}
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between mb-2">
              {LEVELS.map((l, i) => (
                <div
                  key={l.name}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i <= buildScore.levelIndex ? "opacity-100" : "opacity-20"}`}
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
                  <Target size={9} className="inline mr-0.5" />
                  {buildScore.nextLevel} at {buildScore.nextThreshold} pts
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-[var(--color-text-muted)] mt-2 text-center">Maximum level reached.</p>
            )}
          </div>

          {/* Component scores: Build + Community */}
          <div className="grid grid-cols-2 gap-3 pt-5 border-t border-[var(--color-border)]">
            <div
              className="rounded-2xl p-4 border"
              style={{
                background: `${BUILD_SCORE_COLOR}08`,
                borderColor: `${BUILD_SCORE_COLOR}25`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: BUILD_SCORE_COLOR }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: BUILD_SCORE_COLOR }}>
                  Build Score
                </p>
              </div>
              <p className="text-2xl font-black display-num" style={{ color: BUILD_SCORE_COLOR }}>
                <AnimatedCounter value={buildScore.buildScore.score} duration={1800} />
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                From your mods, specs, and photos
              </p>
            </div>
            <div
              className="rounded-2xl p-4 border"
              style={{
                background: `${COMMUNITY_SCORE_COLOR}08`,
                borderColor: `${COMMUNITY_SCORE_COLOR}25`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: COMMUNITY_SCORE_COLOR }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COMMUNITY_SCORE_COLOR }}>
                  Community Score
                </p>
              </div>
              <p className="text-2xl font-black display-num" style={{ color: COMMUNITY_SCORE_COLOR }}>
                <AnimatedCounter value={buildScore.communityScore.score} duration={1800} />
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                From forum activity
              </p>
            </div>
          </div>

          {/* Breakdowns */}
          {(buildScore.buildScore.breakdown.length > 0 ||
            buildScore.communityScore.breakdown.length > 0) && (
            <div className="space-y-3 pt-5 mt-5 border-t border-[var(--color-border)]">
              {buildScore.buildScore.breakdown.length > 0 && (
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider mb-2"
                    style={{ color: BUILD_SCORE_COLOR }}
                  >
                    Build Score breakdown
                  </p>
                  <div className="space-y-1">
                    {buildScore.buildScore.breakdown.map((item, i) => (
                      <div key={`b-${i}`} className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--color-text-secondary)]">{item.label}</span>
                        <span
                          className="text-[11px] font-bold tabular"
                          style={{ color: BUILD_SCORE_COLOR }}
                        >
                          +{item.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {buildScore.communityScore.breakdown.length > 0 && (
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider mb-2"
                    style={{ color: COMMUNITY_SCORE_COLOR }}
                  >
                    Community Score breakdown
                  </p>
                  <div className="space-y-1">
                    {buildScore.communityScore.breakdown.map((item, i) => (
                      <div key={`c-${i}`} className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--color-text-secondary)]">{item.label}</span>
                        <span
                          className="text-[11px] font-bold tabular"
                          style={{ color: COMMUNITY_SCORE_COLOR }}
                        >
                          +{item.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { icon: <Car size={13} />, label: "Cars", value: stats.carCount },
          { icon: <Wrench size={13} />, label: "Mods", value: stats.modCount },
          { icon: <TrendingUp size={13} />, label: "Invested", value: stats.totalInvested, isMoney: true, accent: true },
          { label: "Posts", value: stats.forumPosts },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 text-center">
            <p className={`text-xl font-black display-num ${stat.accent ? "text-[#60A5FA]" : ""}`}>
              {stat.isMoney && stat.value === 0 ? (
                "—"
              ) : (
                <AnimatedCounter
                  value={stat.value}
                  duration={1500}
                  format={stat.isMoney ? (n) => formatCurrency(Math.round(n)) : undefined}
                />
              )}
            </p>
            <p className="text-[9px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Mobile share button */}
      <button
        onClick={() => setSharing(true)}
        className="sm:hidden w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer shadow-[0_4px_20px_rgba(59,130,246,0.25)]"
      >
        <Share2 size={15} />
        Share my build
      </button>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Badges</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                <AnimatedCounter value={earnedBadges.length} duration={1200} /> of {badges.length} earned
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {visibleBadges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} isNew={newBadgeIds.has(badge.id)} />
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

      {/* Awards collection — Feature 16 */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Awards</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              <AnimatedCounter value={unlockedAwards.size} duration={1200} /> of {AWARDS.length} unlocked
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {AWARDS.map((award) => {
            const earned = unlockedAwards.has(award.id);
            const def: AwardDef = AWARDS_BY_ID[award.id];
            const style = RARITY_STYLES[award.rarity];
            const path = BADGE_ICON_PATHS[award.icon];
            return (
              <div
                key={award.id}
                className="rounded-2xl p-3 flex flex-col items-center gap-2 text-center transition-all relative tactile-press"
                style={
                  earned
                    ? {
                        background: `linear-gradient(180deg, ${style.bg}, rgba(15,17,21,0.6))`,
                        border: `1px solid ${style.border}`,
                        boxShadow: style.glow,
                      }
                    : {
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        opacity: 0.45,
                      }
                }
                title={earned ? def.flavor : "Locked"}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: earned ? `${style.color}15` : "rgba(255,255,255,0.04)",
                  }}
                >
                  {path && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={earned ? style.color : "#444"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={path} />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <p className={`text-[10px] font-bold leading-tight truncate ${earned ? "text-white" : "text-[var(--color-text-muted)]"}`}>
                    {earned ? def.name : "???"}
                  </p>
                  <p
                    className="text-[8px] uppercase font-black tracking-wider mt-1"
                    style={{ color: earned ? style.color : "#444" }}
                  >
                    {style.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Profile fields */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Profile Info</p>
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
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{labels[field]}</p>
                  {isEditing ? (
                    field === "bio" ? (
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-accent)] px-4 py-3 text-sm outline-none resize-none text-white"
                        rows={3}
                        placeholder={placeholders[field]}
                        maxLength={500}
                      />
                    ) : (
                      <input
                        autoFocus
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-accent)] px-4 py-3 text-sm outline-none text-white"
                        placeholder={placeholders[field]}
                        maxLength={60}
                      />
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
                      <button
                        onClick={() => saveField(field)}
                        disabled={saving}
                        className="w-8 h-8 rounded-xl bg-[var(--color-success-muted)] flex items-center justify-center hover:opacity-80 cursor-pointer"
                      >
                        <Check size={14} className="text-[var(--color-success)]" />
                      </button>
                      <button
                        onClick={() => setEditingField(null)}
                        className="w-8 h-8 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center hover:opacity-80 cursor-pointer"
                      >
                        <X size={14} className="text-[var(--color-text-muted)]" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingField(field);
                        setEditValue(value ?? "");
                      }}
                      className="w-8 h-8 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                    >
                      <Edit2 size={12} className="text-[var(--color-text-muted)]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Links */}
      <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        {[
          { label: "Settings", href: "/settings", icon: <SettingsIcon size={15} /> },
          { label: "My Garage", href: "/garage", icon: <Car size={15} /> },
          { label: "Stats & Analytics", href: "/stats", icon: <TrendingUp size={15} /> },
          { label: "Forum", href: "/forum", icon: <Wrench size={15} /> },
        ].map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="flex items-center gap-3.5 px-6 py-4 border-b border-[var(--color-border)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          >
            <span className="text-[var(--color-text-muted)]">{link.icon}</span>
            <span className="text-sm font-medium flex-1">{link.label}</span>
            <ChevronRight size={15} className="text-[var(--color-text-disabled)]" />
          </a>
        ))}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3.5 px-6 py-4 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors cursor-pointer border-t border-[var(--color-border)]"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>

      {/* Share card modal */}
      {sharing && profile && primaryCar && buildScore && (
        <CarShareCard
          open={sharing}
          onClose={() => setSharing(false)}
          data={{
            carName: `${primaryCar.year} ${primaryCar.make} ${primaryCar.model}`,
            carImage: primaryCar.cover_image_url,
            buildScore: buildScore.score,
            buildLevel: buildScore.level,
            modCount: stats.modCount,
            totalInvested: stats.totalInvested,
            topCategory,
            topMods,
            username: profile.username,
          }}
        />
      )}

      <div className="h-6" />
    </div>
  );
}

interface ServerBuilderScore {
  documentation_quality: number;
  community_trust: number;
  engagement_authenticity: number;
  build_consistency: number;
  platform_tenure: number;
  composite_score: number;
  tier_label: string;
  tier_color: string;
  breakdown: { component: string; weight: number; raw: number; contribution: number; notes: string[] }[];
}

function BuilderScoreWidget() {
  const [data, setData] = useState<ServerBuilderScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function recalc() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/builder-score/recalculate", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setData(json.builder_score as ServerBuilderScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    recalc();
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl p-4 text-xs text-[var(--color-danger)]" style={{ background: "var(--color-danger-muted)", border: "1px solid rgba(255,69,58,0.25)" }}>
        Builder Score: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-2xl p-5 animate-pulse" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
        <div className="h-4 w-24 bg-[var(--color-bg-elevated)] rounded mb-3" />
        <div className="h-10 w-28 bg-[var(--color-bg-elevated)] rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl p-6" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: data.tier_color }}>
            Builder Score
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black" style={{ color: data.tier_color }}>
              {data.composite_score}
            </span>
            <span className="text-xs font-bold text-[var(--color-text-muted)]">/ 1000</span>
          </div>
        </div>
        <div
          className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
          style={{ background: `${data.tier_color}18`, color: data.tier_color, border: `1px solid ${data.tier_color}40` }}
        >
          {data.tier_label}
        </div>
      </div>
      <div className="space-y-2">
        {data.breakdown.map((b) => (
          <div key={b.component}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-[var(--color-text-secondary)] font-semibold">{b.component}</span>
              <span className="text-[var(--color-text-muted)] font-mono">
                {b.contribution} / {b.weight * 10}
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-bg-elevated)" }}>
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, (b.contribution / (b.weight * 10)) * 100)}%`,
                  background: data.tier_color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={recalc}
        disabled={loading}
        className="mt-4 w-full h-9 rounded-xl text-[11px] font-bold border border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] disabled:opacity-50"
      >
        {loading ? "Recalculating..." : "Recalculate"}
      </button>
    </div>
  );
}
