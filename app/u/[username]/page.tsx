import { notFound } from "next/navigation";
import Link from "next/link";
import { Award, Wrench, Car as CarIcon, ArrowLeft, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { calculateBuildScore, LEVEL_COLORS } from "@/lib/build-score";
import { formatCurrency } from "@/lib/utils";
import type { Car as CarType, ModCategory } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return {
    title: `@${username} on MODVAULT`,
    description: `Check out @${username}'s build on MODVAULT.`,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, bio, avatar_url")
    .eq("username", username)
    .maybeSingle();

  const profile = profileRaw as { user_id: string; username: string; display_name: string | null; bio: string | null; avatar_url: string | null } | null;
  if (!profile) notFound();

  // Public cars only
  const { data: carsRaw } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", profile.user_id)
    .eq("is_public", true)
    .order("is_primary", { ascending: false });

  const cars = (carsRaw ?? []) as CarType[];

  const carIds = cars.map((c) => c.id);
  let allMods: { car_id: string; status: string; cost: number | null; install_date: string | null; notes: string | null; category: ModCategory; name: string }[] = [];
  if (carIds.length > 0) {
    const { data: mods } = await supabase
      .from("mods")
      .select("car_id, status, cost, install_date, notes, category, name")
      .in("car_id", carIds);
    allMods = (mods ?? []) as typeof allMods;
  }

  const installed = allMods.filter((m) => m.status === "installed");
  const totalInvested = installed.reduce((s, m) => s + (m.cost ?? 0), 0);

  const [postRes, replyRes] = await Promise.all([
    supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
    supabase.from("forum_replies").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
  ]);

  const buildScore = calculateBuildScore({
    cars,
    mods: allMods,
    forumPostCount: postRes.count ?? 0,
    forumReplyCount: replyRes.count ?? 0,
  });
  const levelColor = LEVEL_COLORS[buildScore.level];

  const primary = cars.find((c) => c.is_primary) ?? cars[0] ?? null;

  return (
    <div className="min-h-dvh bg-black gradient-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-40 glass border-b border-[var(--color-border)] h-16">
        <div className="flex items-center justify-between h-full px-5 max-w-5xl mx-auto">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm">
              <svg width="17" height="17" viewBox="0 0 14 14" fill="none">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-[13px] tracking-[0.2em] text-gradient-blue uppercase hidden sm:block">MODVAULT</span>
          </Link>
          <Link
            href="/garage"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-white transition-colors"
          >
            <ArrowLeft size={12} />
            Back
          </Link>
        </div>
      </header>

      <main className="px-5 sm:px-8 py-8 max-w-5xl mx-auto stagger-children">
        {/* Profile hero */}
        <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 sm:p-8 flex items-center gap-5 mb-6">
          <div
            className="rounded-2xl flex items-center justify-center flex-shrink-0 glow-accent-sm"
            style={{ background: "linear-gradient(135deg, #3B82F6, #60A5FA)", width: "80px", height: "80px" }}
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <span className="text-3xl font-black text-white">{profile.username[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">
              {profile.display_name || `@${profile.username}`}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] truncate">@{profile.username}</p>
            {profile.bio && <p className="text-xs text-[var(--color-text-secondary)] mt-2 line-clamp-2">{profile.bio}</p>}
            <div className="flex items-center gap-2 mt-3">
              <Award size={13} style={{ color: levelColor }} />
              <span className="text-xs font-bold tabular" style={{ color: levelColor }}>
                {buildScore.score} pts
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: levelColor }}>
                {buildScore.level}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard icon={<CarIcon size={14} />} label="Cars" value={String(cars.length)} />
          <StatCard icon={<Wrench size={14} />} label="Mods" value={String(installed.length)} />
          <StatCard
            icon={<Award size={14} />}
            label="Invested"
            value={totalInvested > 0 ? formatCurrency(totalInvested) : "—"}
            accent
          />
        </div>

        {/* Primary car spotlight */}
        {primary && (
          <section className="mb-6">
            <h2 className="text-lg font-bold tracking-tight mb-3">Primary Build</h2>
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
              {primary.cover_image_url && (
                <div className="relative aspect-video">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={primary.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    {primary.nickname && (
                      <p className="text-[10px] font-bold text-[#60A5FA] tracking-[0.15em] uppercase mb-1">{primary.nickname}</p>
                    )}
                    <h3 className="text-2xl font-black text-white">{primary.year} {primary.make} {primary.model}</h3>
                    {primary.trim && <p className="text-xs text-white/40 mt-1">{primary.trim}</p>}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Other public cars */}
        {cars.length > 1 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold tracking-tight mb-3">More Builds</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cars.filter((c) => c.id !== primary?.id).map((car) => (
                <div key={car.id} className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden card-hover">
                  {car.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={car.cover_image_url} alt="" className="aspect-video w-full object-cover" />
                  )}
                  <div className="p-3">
                    <p className="text-xs font-bold truncate">{car.year} {car.make} {car.model}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {cars.length === 0 && (
          <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] py-16 text-center">
            <Star size={20} className="mx-auto text-[var(--color-text-disabled)] mb-3" />
            <p className="text-sm font-bold text-[var(--color-text-secondary)]">No public builds yet</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Check back later.</p>
          </div>
        )}

        <div className="text-center mt-12">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--color-accent)] text-white text-sm font-bold hover:brightness-110 transition-colors shadow-[0_4px_20px_rgba(59,130,246,0.25)]"
          >
            Build your own garage
          </Link>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-[var(--color-text-muted)] mb-1">
        {icon}
        <p className="text-[9px] uppercase font-bold tracking-wider">{label}</p>
      </div>
      <p className={`text-xl font-black tabular ${accent ? "text-[#60A5FA]" : ""}`}>{value}</p>
    </div>
  );
}
