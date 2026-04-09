"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, AlertTriangle, Trash2, Check, Link as LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  username: string;
  avatar_url: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setEmail(user.email ?? null);
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data as Profile | null);
      setLoading(false);
    });
  }, [router]);

  async function handleAvatarUpload(file: File) {
    if (file.size > 4 * 1024 * 1024) { setUploadError("Max 4MB"); return; }
    setUploadingAvatar(true);
    setUploadError(null);
    setUploadDone(false);
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && profile) {
        setProfile({ ...profile, avatar_url: `${json.avatar_url}?v=${Date.now()}` });
        setUploadDone(true);
        setTimeout(() => setUploadDone(false), 2500);
        router.refresh();
      } else {
        setUploadError("Upload failed. Please try again.");
      }
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploadingAvatar(false);
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
      window.location.href = "/";
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="px-5 sm:px-8 py-8 max-w-lg mx-auto space-y-3">
        {[1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-3xl" />)}
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 py-8 max-w-lg mx-auto space-y-5 pb-12">

      <h1 className="text-2xl font-black tracking-tight mb-6">Settings</h1>

      {/* ── ACCOUNT ── */}
      <section className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Account</p>
        </div>
        <div className="p-6 space-y-5">

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 group cursor-pointer disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #3B82F6, #60A5FA)" }}
              aria-label="Change avatar photo"
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white select-none">
                  {profile?.username?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingAvatar ? (
                  <Loader2 size={16} className="text-white animate-spin" />
                ) : uploadDone ? (
                  <Check size={16} className="text-white" />
                ) : (
                  <Camera size={16} className="text-white" aria-hidden="true" />
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
                if (f) handleAvatarUpload(f);
                e.target.value = "";
              }}
            />
            <div>
              <p className="text-sm font-bold">@{profile?.username}</p>
              {email && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1.5">
                  <LinkIcon size={10} aria-hidden="true" />
                  {email}
                </p>
              )}
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
                Tap photo to change (max 4MB)
              </p>
            </div>
          </div>

          {uploadError && (
            <p className="text-xs text-[var(--color-danger)]" role="alert">{uploadError}</p>
          )}

        </div>
      </section>

      {/* ── DANGER ZONE ── */}
      <section className="rounded-3xl border border-[rgba(255,69,58,0.25)] bg-[var(--color-danger-muted)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[rgba(255,69,58,0.18)]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-[var(--color-danger)]" aria-hidden="true" />
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
              <Trash2 size={13} aria-hidden="true" />
              Delete my account
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-[var(--color-danger)] mb-1">
                  This permanently deletes everything.
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  All cars, mods, photos, renders, and cards will be wiped. This cannot be undone.
                </p>
              </div>
              <div>
                <label
                  htmlFor="confirm-delete-input"
                  className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2"
                >
                  Type DELETE to confirm
                </label>
                <input
                  id="confirm-delete-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full"
                  autoComplete="off"
                />
              </div>
              {deleteError && (
                <p className="text-xs text-[var(--color-danger)]" role="alert">{deleteError}</p>
              )}
              <div className="flex gap-2.5">
                <button
                  onClick={() => { setConfirmDelete(false); setConfirmText(""); setDeleteError(null); }}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || deleting}
                  className="flex-1 h-11 rounded-xl bg-[var(--color-danger)] text-white text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {deleting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <><Trash2 size={13} aria-hidden="true" /> Delete forever</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
