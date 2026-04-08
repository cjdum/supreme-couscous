import { GalleryHorizontal } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { TradingCardSkeleton } from "@/components/ui/skeleton";

export default function CardsLoading() {
  return (
    <div className="min-h-dvh">
      <PageContainer maxWidth="7xl" className="pt-10 pb-16">
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[rgba(123,79,212,0.15)] border border-[rgba(123,79,212,0.3)]">
              <GalleryHorizontal size={18} style={{ color: "#7b4fd4" }} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">Cards</h1>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Loading your vault…</p>
            </div>
          </div>
        </div>

        <div className="flex gap-6 overflow-hidden pb-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <TradingCardSkeleton key={i} />
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
