"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/garage";

  const [form, setForm] = useState<LoginInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<LoginInput>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function setField(field: keyof LoginInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (serverError) setServerError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = loginSchema.safeParse(form);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    setLoading(true);
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(result.data);
    if (error) {
      setServerError(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogleAuth() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}` },
    });
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm">
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <span className="font-bold tracking-wider text-gradient-blue">MODVAULT</span>
          </Link>
          <h1 className="text-xl font-bold mt-6 mb-1">Welcome back</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Sign in to your garage</p>
        </div>
        <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
          <button type="button" onClick={handleGoogleAuth} disabled={loading} className="w-full flex items-center justify-center gap-3 h-10 rounded-[10px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-muted)]">or</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {serverError && <div className="rounded-[8px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] px-4 py-3 text-sm text-[var(--color-danger)]" role="alert">{serverError}</div>}
            <Input label="Email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} error={errors.email} placeholder="you@example.com" autoComplete="email" required />
            <div className="relative">
              <Input label="Password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setField("password", e.target.value)} error={errors.password} placeholder="••••••••" autoComplete="current-password" required />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-[34px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-bright)] transition-colors">Forgot password?</Link>
            </div>
            <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
          </form>
        </div>
        <p className="text-center text-sm text-[var(--color-text-secondary)] mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[var(--color-accent-bright)] hover:underline font-medium">Create one</Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
