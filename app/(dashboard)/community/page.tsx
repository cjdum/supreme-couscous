import { createClient } from "@/lib/supabase/server";
import { Users, Heart, MessageCircle, Globe } from "lucide-react";
import Link from "next/link";
import { formatRelativeDate } from "@/lib/utils";
import { CommunityFilters } from "@/components/community/community-filters";

export const metadata = { title: "Community" };

interface SearchParams {
  make?: string;
  model?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function CommunityPage({ searchParams }: Props) {
  const { make, model } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("cars")
    .select(
      `
      id, make, model, year, trim, nickname, cover_image_url, created_at,
      profiles!inner(username, display_name),
      mods(count),
      likes(count)
    `
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (make) query = query.ilike("make", `%${make}%`);
  if (model) query = query.ilike("model", `%${model}%`);

  const { data: builds } = await query;

  // Get distinct makes for filter
  const { data: makes } = await supabase
    .from("cars")
    .select("make")
    .eq("is_public", true)
    .order("make");

  const uniqueMakes = [...new Set((makes ?? []).map((m) => m.make))];

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Users size={18} className="text-[var(--color-accent)]" />
        <h1 className="text-xl font-bold">Community Builds</h1>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Browse public builds from enthusiasts around the world.
      </p>

      <CommunityFilters makes={uniqueMakes} currentMake={make} currentModel={model} />

      {(!builds || builds.length === 0) ? (
        <div className="text-center py-16">
          <Globe size={32} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-30" />
          <p className="text-sm text-[var(--color-text-muted)]">
            {make || model ? "No builds match your filters" : "No public builds yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {(builds as unknown as {
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
          }[]).map((build) => (
            <Link
              key={build.id}
              href={`/community/${build.id}`}
              className="block rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden card-hover"
            >
              {/* Cover */}
              <div className="h-44 bg-[var(--color-bg-elevated)] relative">
                {build.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={build.cover_image_url}
                    alt={`${build.year} ${build.make} ${build.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-5xl opacity-10">🚗</div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {build.nickname && (
                      <p className="text-xs text-[var(--color-accent-bright)] mb-0.5">{build.nickname}</p>
                    )}
                    <h3 className="text-sm font-semibold">
                      {build.year} {build.make} {build.model}
                    </h3>
                    {build.trim && (
                      <p className="text-xs text-[var(--color-text-muted)]">{build.trim}</p>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] shrink-0">
                    {formatRelativeDate(build.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    by{" "}
                    <span className="text-[var(--color-text-secondary)]">
                      @{build.profiles.username}
                    </span>
                  </p>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Heart size={11} />
                      {(build.likes as { count: number }[])?.[0]?.count ?? 0}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {(build.mods as { count: number }[])?.[0]?.count ?? 0} mods
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
