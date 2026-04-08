import { BarChart2 } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div className="min-h-dvh">
      <PageContainer maxWidth="7xl" className="pt-10 pb-16">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center">
            <BarChart2 size={18} className="text-[var(--color-accent-bright)]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Build Stats</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Crunching the numbers…</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>

        <Skeleton className="h-48 rounded-2xl mb-6" />
        <Skeleton className="h-72 rounded-2xl" />
      </PageContainer>
    </div>
  );
}
