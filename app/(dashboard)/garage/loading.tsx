import { PageContainer } from "@/components/ui/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function GarageLoading() {
  return (
    <div className="min-h-dvh animate-fade">
      {/* Hero */}
      <Skeleton className="w-full" style={{ height: "50vh", borderRadius: 0 }} />

      <PageContainer maxWidth="7xl" className="mt-10">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>

        {/* Timeline */}
        <Skeleton className="h-52 rounded-2xl mb-10" />

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
