"use client";

import { useState, useEffect } from "react";
import { User, Edit2, Check, X, LogOut, Car, Wrench, TrendingUp, Award, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { calculateBuildScore, LEVEL_COLORS } from "@/lib/build-score";

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

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ carCount: 0, modCount: 0, totalInvested: 0 });
  const [buildScore, setBuildScore] = useState<ReturnType<typeof calculateBuildScore> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<keyof Pick<Profile, "display_name" | "bio"> | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? null);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData) setProfile(profileData as Profile);

      // Fetch cars and mods for Build Score
      const { data: carsRaw } = await supabase
        .from("cars")
        .select("id, cover_image_url, horsepower, engine_size, specs_ai_guessed")
        .eq("user_id", user.id);

      const carList = carsRaw ?? [];
      const carIds = carList.map((c) => c.id);

      let modCount = 0;
      let totalInvested = 0;
      let allMods: { status: string; cost: number | null; install_date: string | null; notes: string | null }[] = [];

      if (carIds.length) {
        const { data: mods } = await supabase
          .from("mods")
          .select("cost, status, install_date, notes")
          .in("car_id", carIds);

        allMods = (mods ?? []) as typeof allMods;
        const installedMods = allMods.filter((m) => m.status === "installed");
        modCount = installedMods.length;
        totalInvested = installedMods.reduce((s, m) => s + (m.cost ?? 0), 0);
      }

      // Fetch forum stats
      const { count: postCount } = await supabase
        .from("forum_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: replyCount } = await supabase
        .from("forum_replies")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Calculate Build Score
      const score = calculateBuildScore({
        cars: carList as Parameters<typeof calculateBuildScore>[0]["cars"],
        mods: allMods,
        forumPostCount: postCount ?? 0,
        forumReplyCount: replyCount ?? 0,
      });

      setStats({ carCount: carIds.length, modCount, totalInvested });
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

    if (!error) {
      setProfile((prev) => prev ? { ...prev, [field]: editValue || null } : prev);
    }
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
        <div className="skeleton h-28 rounded-[22px]" />
        <div className="skeleton h-32 rounded-[22px]" />
        <div className="skeleton h-40 rounded-[22px]" />
      </div>
    );
  }

  const levelColor = buildScore ? LEVEL_COLORS[buildScore.level] : "rgba(255,255,255,0.3)";
  const isLegend = buildScore?.level === "Legend";

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-3">
      {/* Avatar + name */}
      <div className="rounded-[22px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-5 flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, #3B82F6, #60A5FA)`,
            }}
          >
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={26} className="text-white" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold truncate">
            {profile?.display_name || `@${profile?.username}`}
          </p>
          <p className="text-xs text-[rgba(255,255,255,0.35)] truncate">@{profile?.username} · {email}</p>
        </div>
      </div>

      {/* Build Score card */}
      {buildScore && (
        <div className="rounded-[22px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)] uppercase tracking-wider mb-1">Build Score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{buildScore.score}</span>
                <Award size={16} className="mb-0.5" style={{ color: levelColor }} />
              </div>
            </div>
            <div
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: `${levelColor}18`,
                color: levelColor,
                border: `1px solid ${levelColor}30`,
              }}
            >
              {buildScore.level}
            </div>
          </div>

          {/* Progress bar */}
          {!isLegend && buildScore.nextLevel && (
            <div className="mb-3">
              <div className="score-bar mb-1.5">
                <div
                  className={`score-bar-fill ${isLegend ? "legend" : ""}`}
                  style={{
                    width: `${buildScore.progress}%`,
                    background: `linear-gradient(90deg, ${levelColor}, ${levelColor}bb)`,
                  }}
                />
              </div>
              <div className="flex justify-between">
                <p className="text-[10px] text-[rgba(255,255,255,0.28)]">{buildScore.score} pts</p>
                <p className="text-[10px] text-[rgba(255,255,255,0.28)]">
                  {buildScore.nextLevel} at {buildScore.nextThreshold}
                </p>
              </div>
            </div>
          )}

          {isLegend && (
            <p className="text-xs text-[rgba(255,255,255,0.4)] mb-3">
              Maximum level reached. You&apos;re a Legend. 🏆
            </p>
          )}

          {/* Score breakdown */}
          {buildScore.breakdown.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-[rgba(255,255,255,0.05)]">
              <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.25)] uppercase tracking-wider mb-2">How you earned it</p>
              {buildScore.breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[11px] text-[rgba(255,255,255,0.45)]">{item.label}</span>
                  <span className="text-[11px] font-semibold text-[rgba(255,255,255,0.6)]">+{item.points}</span>
                </div>
              ))}
            </div>
          )}

          {buildScore.score === 0 && (
            <div className="pt-3 border-t border-[rgba(255,255,255,0.05)]">
              <p className="text-xs text-[rgba(255,255,255,0.35)]">
                Add cars, log mods, and post on the forum to earn points.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: <Car size={11} />, label: "Cars", value: stats.carCount, href: "/garage" },
          { icon: <Wrench size={11} />, label: "Mods", value: stats.modCount, href: null },
          { icon: <TrendingUp size={11} />, label: "Invested", value: stats.totalInvested > 0 ? formatCurrency(stats.totalInvested) : "—", href: null, accent: true },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-3.5 text-center"
          >
            <div className="flex items-center justify-center gap-1 mb-1 text-[rgba(255,255,255,0.28)]">
              {stat.icon}
              <span className="text-[9px] uppercase font-semibold tracking-wider">{stat.label}</span>
            </div>
            <p className={`text-xl font-bold ${stat.accent ? "text-[#60A5FA]" : ""}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Profile fields */}
      <div className="rounded-[22px] border border-[rgba(255,255,255,0.07)] bg-[#111111] overflow-hidden">
        <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.05)]">
          <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider">Profile Info</p>
        </div>

        {(["display_name", "bio"] as const).map((field) => {
          const labels: Record<string, string> = { display_name: "Display Name", bio: "Bio" };
          const placeholders: Record<string, string> = { display_name: "Your name…", bio: "Tell others about your builds…" };
          const isEditing = editingField === field;
          const value = profile?.[field];

          return (
            <div key={field} className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)] last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider mb-1.5">
                    {labels[field]}
                  </p>
                  {isEditing ? (
                    field === "bio" ? (
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-[#1a1a1a] rounded-[8px] border border-[#3B82F6] px-3 py-2 text-sm outline-none resize-none text-white"
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
                        className="w-full bg-[#1a1a1a] rounded-[8px] border border-[#3B82F6] px-3 py-2 text-sm outline-none text-white"
                        placeholder={placeholders[field]}
                        maxLength={60}
                      />
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
                      <button
                        onClick={() => saveField(field)}
                        disabled={saving}
                        className="w-7 h-7 rounded-lg bg-[rgba(34,197,94,0.12)] flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <Check size={13} className="text-[#22c55e]" />
                      </button>
                      <button
                        onClick={() => setEditingField(null)}
                        className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <X size={13} className="text-[rgba(255,255,255,0.35)]" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setEditingField(field); setEditValue(value ?? ""); }}
                      className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center hover:border hover:border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer"
                    >
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
          { label: "Forum Posts", href: "/forum", icon: <Wrench size={14} /> },
        ].map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="flex items-center gap-3 px-5 py-3.5 border-b border-[rgba(255,255,255,0.05)] last:border-0 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
          >
            <span className="text-[rgba(255,255,255,0.35)]">{link.icon}</span>
            <span className="text-sm font-medium flex-1">{link.label}</span>
            <ChevronRight size={14} className="text-[rgba(255,255,255,0.2)]" />
          </a>
        ))}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-[#ef4444] hover:bg-[rgba(239,68,68,0.06)] transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>

      <div className="h-6" />
    </div>
  );
}
