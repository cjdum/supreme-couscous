"use client";

import { useState } from "react";
import { Wrench, BookmarkCheck } from "lucide-react";
import { ModCard } from "@/components/mods/mod-card";
import { AddModButton } from "@/components/mods/add-mod-button";
import { EmptyState } from "@/components/ui/loading";
import type { Mod } from "@/lib/supabase/types";

interface CarDetailTabsProps {
  installed: Mod[];
  wishlist: Mod[];
  carId: string;
}

type Tab = "installed" | "wishlist";

export function CarDetailTabs({ installed, wishlist, carId }: CarDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("installed");

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
  ];

  const activeMods = activeTab === "installed" ? installed : wishlist;

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
                      : "text-[var(--color-warning)]"
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
                        : "bg-[rgba(245,158,11,0.12)] text-[var(--color-warning)]"
                      : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <AddModButton
          carId={carId}
          defaultStatus={activeTab}
          label={activeTab === "installed" ? "Log mod" : "Add to list"}
          variant={activeTab === "installed" ? "primary" : "secondary"}
        />
      </div>

      {/* Mod list */}
      {activeMods.length > 0 ? (
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
              defaultStatus={activeTab}
              label={activeTab === "installed" ? "Log first mod" : "Add to wishlist"}
            />
          }
        />
      )}
    </div>
  );
}
