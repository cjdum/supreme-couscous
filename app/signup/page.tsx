"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, MailCheck, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signupSchema, type SignupInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupInput>({ email: "", password: "", username: "" });
  const [errors, setErrors] = useState<Partial<SignupInput>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function setField(field: keyof SignupInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (serverError) setServerError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = signupSchema.safeParse(form);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors({
        email: flat.email?.[0],
        password: flat.password?.[0],
        username: flat.username?.[0],
      });
      return;
    }

    setLoading(true);
    setServerError(null);

    const supabase = createClient();

    // Check username availability
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", result.data.username.toLowerCase())
      .maybeSingle();

    if (existing) {
      setErrors((prev) => ({ ...prev, username: "This username is already taken" }));
      setLoading(false);
      return;
    }

    const { data: signupData, error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        data: { username: result.data.username.toLowerCase() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/garage`,
      },
    });

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("User already")) {
        setServerError("An account with this email already exists. Try signing in.");
      } else if (error.message.includes("rate limit")) {
        setServerError("Too many signup attempts. Please wait a minute and try again.");
      } else {
        setServerError(error.message);
      }
      setLoading(false);
      return;
    }

    // If Supabase returned a session immediately (email confirmation disabled),
    // skip the "check email" screen and go straight to the garage.
    if (signupData?.session) {
      router.push("/garage");
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleResend() {
    setResending(true);
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email: form.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/garage`,
      },
    });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  }

  async function handleGoogleAuth() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/garage`,
      },
    });
  }

  if (success) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(10,132,255,0.08) 0%, transparent 60%)" }}>
        <div className="w-full max-w-sm text-center animate-scale-in">
          <div className="w-16 h-16 rounded-[20px] bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] flex items-center justify-center mx-auto mb-5">
            <MailCheck size={28} className="text-[#22c55e]" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Check your email</h2>
          <p className="text-sm text-[rgba(255,255,255,0.5)] max-w-xs mx-auto leading-relaxed">
            We sent a confirmation link to{" "}
            <strong className="text-white">{form.email}</strong>.
            Click it to activate your account.
          </p>
          <p className="text-xs text-[rgba(255,255,255,0.3)] mt-3 mb-6">
            Don&apos;t see it? Check your spam folder.
          </p>

          <button
            onClick={handleResend}
            disabled={resending || resent}
            className="inline-flex items-center gap-2 text-sm text-[#60A5FA] hover:text-[#93C5FD] transition-colors disabled:opacity-50 cursor-pointer mb-4"
          >
            <RefreshCw size={13} className={resending ? "animate-spin" : ""} />
            {resent ? "Sent! Check your inbox" : resending ? "Resending…" : "Resend confirmation email"}
          </button>

          <div className="mt-2">
            <Link
              href="/login"
              className="inline-block text-sm text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)] transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-12" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(10,132,255,0.08) 0%, transparent 60%)" }}>
      <div className="w-full max-w-sm animate-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm group-hover:scale-105 transition-transform duration-200">
              <svg width="20" height="20" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-widest text-gradient-blue">MODVAULT</span>
          </Link>
          <h1 className="text-2xl font-bold mt-7 mb-1">Create your account</h1>
          <p className="text-sm text-[rgba(255,255,255,0.4)]">Start building your garage</p>
        </div>

        <div className="rounded-[22px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-6 shadow-2xl">
          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-[12px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] hover:bg-[#222222] text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
            <span className="text-xs text-[rgba(255,255,255,0.28)]">or</span>
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {serverError && (
              <div className="rounded-[10px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] px-4 py-3 text-sm text-[#f87171]" role="alert">
                {serverError}
              </div>
            )}

            <Input
              label="Username"
              type="text"
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              error={errors.username}
              placeholder="fastlane42"
              autoComplete="username"
              required
              hint="Letters, numbers, and underscores only"
            />

            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                error={errors.password}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                hint="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[34px] text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)] transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>

            <p className="text-xs text-center text-[rgba(255,255,255,0.25)]">
              By creating an account you agree to our{" "}
              <Link href="/terms" className="text-[rgba(255,255,255,0.4)] hover:text-[#60A5FA] transition-colors">
                Terms of Service
              </Link>
              .
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-[rgba(255,255,255,0.4)] mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#60A5FA] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
