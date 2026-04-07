"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wrench, BookmarkCheck, Image as ImageIcon, Check, Loader2, Sparkles } from "lucide-react";
import { ModCard } from "@/components/mods/mod-card";
import { AddModButton } from "@/components/mods/add-mod-button";
import { WishlistPlanner } from "@/components/garage/wishlist-planner";
import { EmptyState } from "@/components/ui/loading";
import { haptic } from "@/lib/haptics";
import type { Mod, Render } from "@/lib/supabase/types";

interface CarDetailTabsProps {
  installed: Mod[];
  wishlist: Mod[];
  renders: Render[];
  carId: string;
}

type Tab = "installed" | "wishlist" | "renders";

export function CarDetailTabs({ installed, wishlist, renders, carId }: CarDetailTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("installed");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function setAsBanner(renderId: string) {
    if (pendingId) return;
    setPendingId(renderId);
    try {
      const res = await fetch(`/api/renders/${renderId}/set-banner`, { method: "POST" });
      if (res.ok) {
        haptic("success");
        // Refresh the server component tree so the hero swaps to the new banner
        startTransition(() => router.refresh());
      }
    } finally {
      setPendingId(null);
    }
  }

  const tabs: { id: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    {
      id: "installed",
      label: "Installed",
      count: installed.length,
      icon: <Wrench size={13} />,
    },
    {
      id: "wishlist",
      label: "Wishlist",
      count: wishlist.length,
      icon: <BookmarkCheck size={13} />,
    },
    {
      id: "renders",
      label: "Renders",
      count: renders.length,
      icon: <ImageIcon size={13} />,
    },
  ];

  const activeMods = activeTab === "installed" ? installed : activeTab === "wishlist" ? wishlist : [];

  return (
    <div>
      {/* Tab row + Add button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-[var(--color-bg-elevated)] rounded-xl p-1 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 min-h-[44px] h-10 px-4 rounded-[9px] text-xs font-medium transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              <span
                className={
                  activeTab === tab.id
                    ? tab.id === "installed"
                      ? "text-[var(--color-success)]"
                      : tab.id === "wishlist"
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--color-accent-bright)]"
                    : ""
                }
              >
                {tab.icon}
              </span>
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    activeTab === tab.id
                      ? tab.id === "installed"
                        ? "bg-[rgba(34,197,94,0.12)] text-[var(--color-success)]"
                        : tab.id === "wishlist"
                        ? "bg-[rgba(245,158,11,0.12)] text-[var(--color-warning)]"
                        : "bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)]"
                      : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab !== "renders" ? (
          <div className="flex items-center gap-2">
            {activeTab === "wishlist" && wishlist.length > 0 && (
              <WishlistPlanner carId={carId} wishlistCount={wishlist.length} />
            )}
            <AddModButton
              carId={carId}
              defaultStatus={activeTab}
              label={activeTab === "installed" ? "Log mod" : "Add to list"}
              variant={activeTab === "installed" ? "primary" : "secondary"}
            />
          </div>
        ) : (
          <Link
            href={`/visualizer?carId=${carId}`}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
          >
            <Sparkles size={12} /> New render
          </Link>
        )}
      </div>

      {/* ── Mods (installed/wishlist) ── */}
      {activeTab !== "renders" && (
        activeMods.length > 0 ? (
          <div className="space-y-2.5">
            {activeMods.map((mod) => (
              <ModCard key={mod.id} mod={mod} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={
              activeTab === "installed" ? (
                <Wrench size={26} />
              ) : (
                <BookmarkCheck size={26} />
              )
            }
            title={
              activeTab === "installed"
                ? "No mods installed yet"
                : "Wishlist is empty"
            }
            description={
              activeTab === "installed"
                ? "Log your first modification to start tracking your build."
                : "Add parts you're planning to buy."
            }
            action={
              <AddModButton
                carId={carId}
                defaultStatus={activeTab as "installed" | "wishlist"}
                label={activeTab === "installed" ? "Log first mod" : "Add to wishlist"}
              />
            }
          />
        )
      )}

      {/* ── Renders ── */}
      {activeTab === "renders" && (
        renders.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {renders.map((render) => {
              const isActive = render.is_banner;
              const isPending = pendingId === render.id;
              return (
                <div
                  key={render.id}
                  className={`relative rounded-2xl overflow-hidden border transition-all ${
                    isActive
                      ? "border-[var(--color-accent)] shadow-[0_0_0_3px_rgba(59,130,246,0.18)]"
                      : "border-[var(--color-border)] hover:border-[var(--color-border-bright)]"
                  }`}
                >
                  {render.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={render.image_url}
                      alt={render.user_prompt}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-[var(--color-bg-elevated)] flex items-center justify-center">
                      <ImageIcon size={20} className="text-[var(--color-text-muted)]" />
                    </div>
                  )}

                  {isActive && (
                    <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-accent)] text-white text-[9px] font-bold uppercase tracking-wider">
                      <Check size={10} /> Banner
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent">
                    <p className="text-[10px] text-white/90 font-medium line-clamp-2 mb-1.5">
                      {render.user_prompt}
                    </p>
                    {!isActive && render.image_url && (
                      <button
                        type="button"
                        onClick={() => setAsBanner(render.id)}
                        disabled={isPending}
                        className="w-full h-7 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold text-white hover:bg-white/20 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                      >
                        {isPending ? (
                          <>
                            <Loader2 size={10} className="animate-spin" /> Setting…
                          </>
                        ) : (
                          "Set as banner"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<ImageIcon size={26} />}
            title="No renders yet"
            description="Use the AI visualizer to imagine your car with new mods."
            action={
              <Link
                href={`/visualizer?carId=${carId}`}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
              >
                <Sparkles size={12} /> Make a render
              </Link>
            }
          />
        )
      )}
    </div>
  );
}
