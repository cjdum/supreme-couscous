"use client";

import { useState, useEffect } from "react";
import { User, Edit2, Check, X, LogOut, Car, Wrench, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

interface Stats {
  carCount: number;
  modCount: number;
  totalSpent: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ carCount: 0, modCount: 0, totalSpent: 0 });
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<keyof Pick<Profile, "display_name" | "bio"> | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? null);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData) setProfile(profileData as Profile);

      // Get stats
      const { data: cars } = await supabase.from("cars").select("id").eq("user_id", user.id);
      const carIds = (cars ?? []).map((c) => c.id);
      let modCount = 0;
      let totalSpent = 0;

      if (carIds.length) {
        const { data: mods } = await supabase
          .from("mods")
          .select("cost, status")
          .in("car_id", carIds)
          .eq("status", "installed");
        modCount = (mods ?? []).length;
        totalSpent = (mods ?? []).reduce((s, m) => s + (m.cost ?? 0), 0);
      }

      setStats({ carCount: carIds.length, modCount, totalSpent });
      setLoading(false);
    });
  }, [router]);

  async function saveField(field: keyof Pick<Profile, "display_name" | "bio">) {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: editValue || null })
      .eq("id", profile.id);

    if (!error) {
      setProfile((prev) => prev ? { ...prev, [field]: editValue || null } : prev);
    }
    setSaving(false);
    setEditingField(null);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="px-4 py-5 max-w-lg mx-auto">
        <div className="skeleton h-24 rounded-[18px] mb-4" />
        <div className="skeleton h-40 rounded-[18px]" />
      </div>
    );
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
      {/* Avatar + name */}
      <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[#6ac4dc] flex items-center justify-center flex-shrink-0">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          ) : (
            <User size={28} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold truncate">@{profile?.username}</p>
          <p className="text-sm text-[var(--color-text-muted)] truncate">{email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1 text-[var(--color-text-muted)]">
            <Car size={11} />
            <span className="text-[9px] uppercase font-semibold tracking-wider">Cars</span>
          </div>
          <p className="text-xl font-bold">{stats.carCount}</p>
        </div>
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1 text-[var(--color-text-muted)]">
            <Wrench size={11} />
            <span className="text-[9px] uppercase font-semibold tracking-wider">Mods</span>
          </div>
          <p className="text-xl font-bold">{stats.modCount}</p>
        </div>
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1 text-[var(--color-text-muted)]">
            <DollarSign size={11} />
            <span className="text-[9px] uppercase font-semibold tracking-wider">Spent</span>
          </div>
          <p className="text-xl font-bold text-[var(--color-accent-bright)]">
            {stats.totalSpent > 0 ? formatCurrency(stats.totalSpent) : "—"}
          </p>
        </div>
      </div>

      {/* Profile fields */}
      <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Profile Info</p>
        </div>

        {(["display_name", "bio"] as const).map((field) => {
          const labels: Record<string, string> = { display_name: "Display Name", bio: "Bio" };
          const placeholders: Record<string, string> = { display_name: "Your name…", bio: "Tell others about your builds…" };
          const isEditing = editingField === field;
          const value = profile?.[field];

          return (
            <div key={field} className="px-5 py-3.5 border-b border-[var(--color-border)] last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{labels[field]}</p>
                  {isEditing ? (
                    field === "bio" ? (
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-[var(--color-bg-elevated)] rounded-[8px] border border-[var(--color-accent)] px-3 py-2 text-sm outline-none resize-none"
                        rows={3}
                        placeholder={placeholders[field]}
                        maxLength={500}
                      />
                    ) : (
                      <input
                        autoFocus
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-[var(--color-bg-elevated)] rounded-[8px] border border-[var(--color-accent)] px-3 py-2 text-sm outline-none"
                        placeholder={placeholders[field]}
                        maxLength={60}
                      />
                    )
                  ) : (
                    <p className={`text-sm ${value ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-disabled)] italic"}`}>
                      {value || placeholders[field]}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1 mt-4">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveField(field)}
                        disabled={saving}
                        className="w-7 h-7 rounded-lg bg-[var(--color-success-muted)] flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <Check size={13} className="text-[var(--color-success)]" />
                      </button>
                      <button
                        onClick={() => setEditingField(null)}
                        className="w-7 h-7 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <X size={13} className="text-[var(--color-text-muted)]" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setEditingField(field); setEditValue(value ?? ""); }}
                      className="w-7 h-7 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center hover:border hover:border-[var(--color-border-bright)] transition-colors cursor-pointer"
                    >
                      <Edit2 size={12} className="text-[var(--color-text-muted)]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sign out */}
      <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors cursor-pointer"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>

      <div className="h-6" />
    </div>
  );
}
