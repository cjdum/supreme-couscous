import { createClient } from "@/lib/supabase/server";
import { Users, Heart, Globe, Trophy } from "lucide-react";
import Link from "next/link";
import { formatRelativeDate } from "@/lib/utils";
import { CommunityFilters } from "@/components/community/community-filters";

export const metadata = { title: "Community — MODVAULT" };

interface SearchParams {
  make?: string;
  model?: string;
  sort?: "recent" | "top";
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function CommunityPage({ searchParams }: Props) {
  const { make, model, sort } = await searchParams;
  const supabase = await createClient();
  const sortMode: "recent" | "top" = sort === "top" ? "top" : "recent";

  let query = supabase
    .from("cars")
    .select(
      `id, make, model, year, trim, nickname, cover_image_url, created_at,
       profiles!inner(username, display_name),
       mods(count),
       likes(count)`
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(sortMode === "top" ? 100 : 50);

  if (make) query = query.ilike("make", `%${make}%`);
  if (model) query = query.ilike("model", `%${model}%`);

  const { data: builds } = await query;

  const { data: makes } = await supabase
    .from("cars")
    .select("make")
    .eq("is_public", true)
    .order("make");

  const uniqueMakes = [...new Set((makes ?? []).map((m) => m.make))];

  type Build = {
    id: string;
    make: string;
    model: string;
    year: number;
    trim: string | null;
    nickname: string | null;
    cover_image_url: string | null;
    created_at: string;
    profiles: { username: string; display_name: string | null };
    mods: { count: number }[];
    likes: { count: number }[];
  };

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Users size={18} className="text-[var(--color-accent)]" />
        <div>
          <h1 className="text-xl font-bold">Community Builds</h1>
          <p className="text-xs text-[var(--color-text-muted)]">Browse public builds worldwide</p>
        </div>
      </div>

      <div className="mb-5 mt-4">
        <CommunityFilters makes={uniqueMakes} currentMake={make} currentModel={model} />
      </div>

      {/* Sort tabs — Feature 19 top builds */}
      <div className="flex gap-2 mb-4">
        <Link
          href={`/community${make || model ? `?${new URLSearchParams({ ...(make ? { make } : {}), ...(model ? { model } : {}) }).toString()}` : ""}`}
          className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[11px] font-bold transition-all ${
            sortMode === "recent"
              ? "bg-[var(--color-accent)] text-white shadow-[0_4px_16px_rgba(59,130,246,0.25)]"
              : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white"
          }`}
        >
          <Globe size={11} />
          Recent
        </Link>
        <Link
          href={`/community?${new URLSearchParams({ sort: "top", ...(make ? { make } : {}), ...(model ? { model } : {}) }).toString()}`}
          className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[11px] font-bold transition-all ${
            sortMode === "top"
              ? "bg-[var(--color-warning)] text-black shadow-[0_4px_16px_rgba(245,158,11,0.30)]"
              : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white"
          }`}
        >
          <Trophy size={11} />
          Top builds
        </Link>
      </div>

      {(!builds || builds.length === 0) ? (
        <div className="text-center py-16">
          <Globe size={30} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-30" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {make || model ? "No builds match your filters" : "No public builds yet"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Make your build public to appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(() => {
            const list = builds as unknown as Build[];
            const sorted =
              sortMode === "top"
                ? [...list]
                    .sort(
                      (a, b) =>
                        ((b.likes?.[0]?.count ?? 0) - (a.likes?.[0]?.count ?? 0)) ||
                        ((b.mods?.[0]?.count ?? 0) - (a.mods?.[0]?.count ?? 0))
                    )
                    .slice(0, 25)
                : list;
            return sorted.map((build) => {
            const likeCount = (build.likes as { count: number }[])?.[0]?.count ?? 0;
            const modCount = (build.mods as { count: number }[])?.[0]?.count ?? 0;

            return (
              <Link
                key={build.id}
                href={`/community/${build.id}`}
                className="block rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden card-hover group"
              >
                {/* Cover photo */}
                <div className="relative" style={{ aspectRatio: "16/9" }}>
                  {build.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={build.cover_image_url}
                      alt={`${build.year} ${build.make} ${build.model}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        background: `radial-gradient(ellipse at 30% 50%, rgba(10,132,255,0.15) 0%, transparent 65%),
                                     linear-gradient(160deg, rgba(10,132,255,0.08) 0%, #000 70%)`,
                      }}
                    >
                      <svg viewBox="0 0 120 54" width="80" height="36" fill="none" aria-hidden="true" style={{ opacity: 0.12 }}>
                        <path d="M12 42l9-24h78l9 24H12z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
                        <ellipse cx="30" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
                        <ellipse cx="90" cy="43" rx="6" ry="6" stroke="white" strokeWidth="2.5" />
                      </svg>
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Like count badge */}
                  {likeCount > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                      <Heart size={10} className="text-[var(--color-danger)]" fill="currentColor" />
                      <span className="text-[10px] font-bold text-white">{likeCount}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3.5">
                  {build.nickname && (
                    <p className="text-[10px] text-[var(--color-accent-bright)] font-semibold mb-0.5 uppercase tracking-wide">{build.nickname}</p>
                  )}
                  <h3 className="text-sm font-bold leading-snug">
                    {build.year} {build.make} {build.model}
                  </h3>
                  {build.trim && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{build.trim}</p>}

                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[var(--color-border)]">
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      by <span className="text-[var(--color-text-secondary)] font-medium">@{build.profiles.username}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--color-text-muted)]">{modCount} mods</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">{formatRelativeDate(build.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          });
          })()}
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}
