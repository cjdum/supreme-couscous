"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User, Bell, Globe, Lock, Palette, Trash2, Loader2, Camera, Check, AlertTriangle,
  Sun, Moon, Settings as SettingsIcon, ChevronRight, Car as CarIcon
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Toggle } from "@/components/ui/toggle";
import { sanitize } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import {
  loadPreferences,
  savePreferences,
  applyTheme,
  type Preferences,
  type DistanceUnit,
  type Currency,
  type Theme,
  type SidebarSide,
} from "@/lib/preferences";
import type { Car as CarType } from "@/lib/supabase/types";

export default function SettingsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    id: string;
    user_id: string;
    username: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [cars, setCars] = useState<CarType[]>([]);

  // Account form
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Preferences (localStorage)
  const [prefs, setPrefs] = useState<Preferences>(() => loadPreferences());

  // Privacy
  const [profilePublic, setProfilePublic] = useState(true);
  const [savingCars, setSavingCars] = useState<Set<string>>(new Set());

  // Danger zone
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(prefs.theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        .select("id, user_id, username, display_name, bio, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profileData) {
        setProfile(profileData as typeof profile extends infer T ? T : never);
        setDisplayName(profileData.display_name ?? "");
        setBio(profileData.bio ?? "");
      }

      const { data: carsRaw } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setCars((carsRaw ?? []) as CarType[]);

      setLoading(false);
    });
  }, [router]);

  async function saveAccount() {
    setSavingAccount(true);
    setAccountSaved(false);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName ? sanitize(displayName) : null,
          bio: bio ? sanitize(bio) : null,
        }),
      });
      if (res.ok) {
        haptic("success");
        setAccountSaved(true);
        setTimeout(() => setAccountSaved(false), 2000);
      }
    } finally {
      setSavingAccount(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      alert("Max 4MB");
      return;
    }
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && profile) {
        // The new URL is uniquely timestamped at the path level, but we still
        // append a query buster so any in-memory <img> caches forget the old
        // bytes immediately.
        const fresh = `${json.avatar_url}?v=${Date.now()}`;
        setProfile({ ...profile, avatar_url: fresh });
        haptic("success");
        // Force RSC re-fetch so server-rendered pages (forum, /u/[username],
        // bottom nav header) pick up the new avatar on next navigation.
        router.refresh();
      } else {
        setSaveError("Couldn't upload avatar. Please try again.");
      }
    } catch {
      setSaveError("Couldn't upload avatar. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function updatePref<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    const next = savePreferences({ [key]: value });
    setPrefs(next);
    haptic("light");
    if (key === "theme") {
      applyTheme(value as Theme);
    }
  }

  async function toggleCarPublic(carId: string, isPublic: boolean) {
    setSavingCars((s) => new Set(s).add(carId));
    try {
      const res = await fetch(`/api/cars/${carId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: isPublic }),
      });
      if (res.ok) {
        setCars((cs) => cs.map((c) => (c.id === carId ? { ...c, is_public: isPublic } : c)));
        haptic("light");
      }
    } finally {
      setSavingCars((s) => {
        const next = new Set(s);
        next.delete(carId);
        return next;
      });
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to delete account");
      }
      haptic("heavy");
      window.location.href = "/";
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="px-5 py-6 max-w-2xl mx-auto space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-32 rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-2xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center">
          <SettingsIcon size={17} className="text-[var(--color-accent-bright)]" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Settings</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Account, privacy, and preferences</p>
        </div>
      </div>

      {/* ── ACCOUNT ── */}
      <section className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        <SectionHeader icon={<User size={14} />} title="Account" />

        <div className="p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 group cursor-pointer"
              style={{ background: "linear-gradient(135deg, #3B82F6, #60A5FA)" }}
              aria-label="Change avatar"
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-white">
                  {profile?.username?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingAvatar ? (
                  <Loader2 size={18} className="text-white animate-spin" />
                ) : (
                  <Camera size={18} className="text-white" />
                )}
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
                e.target.value = "";
              }}
            />
            <div>
              <p className="text-sm font-bold">@{profile?.username}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{email}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">Tap photo to upload (max 4MB)</p>
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              className="w-full"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about your builds..."
              rows={3}
              maxLength={500}
              className="w-full resize-none"
            />
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1 text-right tabular">{bio.length} / 500</p>
          </div>

          {saveError && (
            <div
              role="alert"
              className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-4 py-3 text-xs text-[var(--color-danger)] flex items-center justify-between gap-3"
            >
              <span>{saveError}</span>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="text-[var(--color-danger)] hover:text-white transition-colors cursor-pointer text-base leading-none"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          <button
            onClick={saveAccount}
            disabled={savingAccount}
            className="w-full h-11 rounded-xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingAccount ? (
              <Loader2 size={14} className="animate-spin" />
            ) : accountSaved ? (
              <>
                <Check size={14} /> Saved
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </section>

      {/* ── APPEARANCE ── */}
      <section className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        <SectionHeader icon={<Palette size={14} />} title="Appearance" />

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Theme
            </label>
            <div className="grid grid-cols-2 gap-3">
              <ThemeButton
                active={prefs.theme === "dark"}
                onClick={() => updatePref("theme", "dark")}
                icon={<Moon size={16} />}
                label="Dark"
              />
              <ThemeButton
                active={prefs.theme === "light"}
                onClick={() => updatePref("theme", "light")}
                icon={<Sun size={16} />}
                label="Light"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Sidebar position
            </label>
            <SegmentedControl<SidebarSide>
              value={prefs.sidebarSide ?? "right"}
              onChange={(v) => updatePref("sidebarSide", v)}
              options={[
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── GARAGE PREFS ── */}
      <section className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        <SectionHeader icon={<CarIcon size={14} />} title="Garage" />

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Distance unit
            </label>
            <SegmentedControl<DistanceUnit>
              value={prefs.distanceUnit}
              onChange={(v) => updatePref("distanceUnit", v)}
              options={[
                { value: "miles", label: "Miles" },
                { value: "km", label: "Kilometers" },
              ]}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Currency
            </label>
            <SegmentedControl<Currency>
              value={prefs.currency}
              onChange={(v) => updatePref("currency", v)}
              options={[
                { value: "USD", label: "$ USD" },
                { value: "EUR", label: "€ EUR" },
                { value: "GBP", label: "£ GBP" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── NOTIFICATIONS ── */}
      <section className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        <SectionHeader icon={<Bell size={14} />} title="Notifications" />

        <div className="p-6">
          <ToggleRow
            label="Email notifications"
            description="Get notified about replies, new badges, and forum activity"
            checked={prefs.emailNotifications}
            onChange={(v) => updatePref("emailNotifications", v)}
          />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-3 italic">
            Email delivery is coming soon — your preference is saved for when it ships.
          </p>
        </div>
      </section>

      {/* ── PRIVACY ── */}
      <section className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        <SectionHeader icon={<Lock size={14} />} title="Privacy" />

        <div className="p-6 space-y-5">
          <ToggleRow
            label="Public profile"
            description="Allow anyone to view your profile at /u/your-username"
            checked={profilePublic}
            onChange={setProfilePublic}
            secondary
          />
          {cars.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                Per-car visibility
              </p>
              <div className="space-y-2.5">
                {cars.map((car) => (
                  <div
                    key={car.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">
                        {car.year} {car.make} {car.model}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                        {car.is_public ? (
                          <>
                            <Globe size={9} className="text-[var(--color-success)]" /> Public
                          </>
                        ) : (
                          <>
                            <Lock size={9} /> Private
                          </>
                        )}
                      </p>
                    </div>
                    <Toggle
                      checked={car.is_public}
                      onChange={(v) => toggleCarPublic(car.id, v)}
                      disabled={savingCars.has(car.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── DANGER ZONE ── */}
      <section className="rounded-3xl border border-[rgba(255,69,58,0.25)] bg-[var(--color-danger-muted)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[rgba(255,69,58,0.20)]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-[var(--color-danger)]" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-danger)]">
              Danger zone
            </p>
          </div>
        </div>

        <div className="p-6">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--color-bg-card)] border border-[rgba(255,69,58,0.30)] text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              Delete my account
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-[var(--color-danger)] mb-1">
                  This permanently deletes everything.
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  All cars, mods, photos, renders, forum posts, and badges will be wiped.
                  This cannot be undone.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Type DELETE to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full"
                />
              </div>
              {deleteError && (
                <p className="text-xs text-[var(--color-danger)]">{deleteError}</p>
              )}
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setConfirmDelete(false);
                    setConfirmText("");
                  }}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || deleting}
                  className="flex-1 h-11 rounded-xl bg-[var(--color-danger)] text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={13} />
                      Delete forever
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="h-8" />
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
      <span className="text-[var(--color-text-muted)]">{icon}</span>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{title}</p>
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 h-12 rounded-2xl border transition-all cursor-pointer ${
        active
          ? "bg-[var(--color-accent-muted)] border-[var(--color-accent)] text-[var(--color-accent-bright)]"
          : "bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)]"
      }`}
    >
      {icon}
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex bg-[var(--color-bg-elevated)] rounded-xl p-1 gap-1 border border-[var(--color-border)]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 h-9 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            value === opt.value
              ? "bg-[var(--color-bg-card)] text-white shadow-sm"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  secondary,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  secondary?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
      {secondary && <ChevronRight size={12} className="hidden text-[var(--color-text-muted)]" />}
    </div>
  );
}

