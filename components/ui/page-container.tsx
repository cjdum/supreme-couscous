import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Maximum content width — defaults to max-w-6xl */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full";
  /** Disable bottom padding (for pages with their own custom layout) */
  noBottomPad?: boolean;
}

const MAX_W = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
} as const;

/**
 * Consistent page wrapper with responsive horizontal padding
 * (mobile px-4, tablet px-6, desktop px-8) and built-in bottom-nav clearance.
 */
export function PageContainer({
  children,
  className,
  maxWidth = "6xl",
  noBottomPad = false,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "px-4 sm:px-6 lg:px-8 mx-auto w-full",
        MAX_W[maxWidth],
        // Reserve room for the mobile bottom nav so content doesn't end up
        // hidden behind it. Desktop has a sidebar, so no extra space needed.
        !noBottomPad && "pb-20 lg:pb-12",
        className
      )}
    >
      {children}
    </div>
  );
}
