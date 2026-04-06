import { cn } from "@/lib/utils";
import type { ModCategory } from "@/lib/supabase/types";
import { getCategoryLabel } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "danger" | "muted";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default:
      "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
    accent:
      "bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)] border border-[rgba(59,130,246,0.2)]",
    success:
      "bg-[rgba(34,197,94,0.1)] text-[var(--color-success)] border border-[rgba(34,197,94,0.2)]",
    warning:
      "bg-[rgba(245,158,11,0.1)] text-[var(--color-warning)] border border-[rgba(245,158,11,0.2)]",
    danger:
      "bg-[rgba(239,68,68,0.1)] text-[var(--color-danger)] border border-[rgba(239,68,68,0.2)]",
    muted:
      "bg-transparent text-[var(--color-text-muted)] border border-[var(--color-border)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium leading-none",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

interface CategoryBadgeProps {
  category: ModCategory;
  className?: string;
}

const CATEGORY_STYLES: Record<ModCategory, { bg: string; text: string; border: string }> = {
  engine: {
    bg: "rgba(249,115,22,0.1)",
    text: "#f97316",
    border: "rgba(249,115,22,0.25)",
  },
  suspension: {
    bg: "rgba(139,92,246,0.1)",
    text: "#8b5cf6",
    border: "rgba(139,92,246,0.25)",
  },
  aero: {
    bg: "rgba(6,182,212,0.1)",
    text: "#06b6d4",
    border: "rgba(6,182,212,0.25)",
  },
  interior: {
    bg: "rgba(236,72,153,0.1)",
    text: "#ec4899",
    border: "rgba(236,72,153,0.25)",
  },
  wheels: {
    bg: "rgba(234,179,8,0.1)",
    text: "#eab308",
    border: "rgba(234,179,8,0.25)",
  },
  exhaust: {
    bg: "rgba(148,163,184,0.1)",
    text: "#94a3b8",
    border: "rgba(148,163,184,0.25)",
  },
  electronics: {
    bg: "rgba(16,185,129,0.1)",
    text: "#10b981",
    border: "rgba(16,185,129,0.25)",
  },
  other: {
    bg: "rgba(107,114,128,0.1)",
    text: "#9ca3af",
    border: "rgba(107,114,128,0.25)",
  },
};

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const style = CATEGORY_STYLES[category];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium leading-none border",
        className
      )}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      {getCategoryLabel(category)}
    </span>
  );
}

export function StatusBadge({ status }: { status: "installed" | "wishlist" }) {
  return status === "installed" ? (
    <Badge variant="success">Installed</Badge>
  ) : (
    <Badge variant="warning">Wishlist</Badge>
  );
}
