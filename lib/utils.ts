import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ModCategory } from "./supabase/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export const MOD_CATEGORIES: { value: ModCategory; label: string; color: string }[] = [
  { value: "engine", label: "Engine", color: "#f97316" },
  { value: "suspension", label: "Suspension", color: "#8b5cf6" },
  { value: "aero", label: "Aero", color: "#06b6d4" },
  { value: "interior", label: "Interior", color: "#ec4899" },
  { value: "wheels", label: "Wheels", color: "#eab308" },
  { value: "exhaust", label: "Exhaust", color: "#94a3b8" },
  { value: "electronics", label: "Electronics", color: "#10b981" },
  { value: "other", label: "Other", color: "#6b7280" },
];

export function getCategoryColor(category: ModCategory): string {
  return MOD_CATEGORIES.find((c) => c.value === category)?.color ?? "#6b7280";
}

export function getCategoryLabel(category: ModCategory): string {
  return MOD_CATEGORIES.find((c) => c.value === category)?.label ?? "Other";
}

export function getCarDisplayName(car: { year: number; make: string; model: string; nickname?: string | null }): string {
  const base = `${car.year} ${car.make} ${car.model}`;
  return car.nickname ? `${car.nickname} (${base})` : base;
}

/** Sanitize user-facing text — strip HTML tags and control chars */
export function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}
