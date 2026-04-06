import { cn } from "@/lib/utils";

export function Spinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };
  return (
    <svg
      className={cn("animate-spin text-[var(--color-accent)]", sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
      role="status"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-[16px] border border-[var(--color-border)] p-4 space-y-3">
      <div className="skeleton h-4 w-3/4 rounded-md" />
      <div className="skeleton h-3 w-1/2 rounded-md" />
      <div className="skeleton h-3 w-2/3 rounded-md" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
      <div className="p-4 rounded-2xl bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-[var(--color-text-primary)]">{title}</p>
        {description && (
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
