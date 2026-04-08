import { cn } from "@/lib/utils";

/**
 * Base skeleton primitive — leverages the global `.skeleton` shimmer class
 * defined in `app/globals.css`. Wrap this in any sizing classes you need.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton rounded-lg", className)} style={style} />;
}

/** Skeleton that roughly matches trading-card proportions (scale 0.6 by default). */
export function TradingCardSkeleton({ scale = 0.6 }: { scale?: number }) {
  const W = 280 * scale;
  const H = 368 * scale;
  return (
    <div
      className="skeleton rounded-xl flex-shrink-0"
      style={{
        width: W,
        height: H,
        border: "2px solid rgba(168,85,247,0.18)",
      }}
    />
  );
}

/** Horizontal rail of trading-card skeletons, matches the cards page layout. */
export function CardCollectionSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-6 overflow-hidden py-6">
      {Array.from({ length: count }).map((_, i) => (
        <TradingCardSkeleton key={i} />
      ))}
    </div>
  );
}
