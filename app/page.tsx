import Link from "next/link";
import { ArrowRight, BarChart2, Sparkles, Users, Shield, Zap, Camera } from "lucide-react";

const FEATURES = [
  {
    icon: BarChart2,
    title: "Mod Tracker",
    description:
      "Log every install with cost, date, shop, and photos. Track your total spend by category.",
    color: "#3b82f6",
  },
  {
    icon: Sparkles,
    title: "AI Visualizer",
    description:
      "Describe your dream build in plain text. Get a photorealistic render in seconds.",
    color: "#8b5cf6",
  },
  {
    icon: Users,
    title: "Community",
    description:
      "Browse builds, filter by make and model, like, comment, and get inspired.",
    color: "#06b6d4",
  },
  {
    icon: Shield,
    title: "Secure by Design",
    description:
      "Row-level security ensures only you can access your data. No exceptions.",
    color: "#22c55e",
  },
  {
    icon: Zap,
    title: "AI Suggestions",
    description:
      "Get personalized mod recommendations based on your car and existing build.",
    color: "#f59e0b",
  },
  {
    icon: Camera,
    title: "Build Gallery",
    description:
      "Keep a visual history of your build with photos tied to each modification.",
    color: "#ec4899",
  },
];

const STATS = [
  { value: "50+", label: "Mod categories" },
  { value: "100%", label: "Private by default" },
  { value: "AI", label: "Powered visualizer" },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-40 glass border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between h-14 px-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-sm tracking-wider text-gradient-blue">MODVAULT</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="h-8 px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="h-8 px-4 text-sm font-medium bg-[var(--color-accent)] text-white rounded-[8px] flex items-center hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent-muted)] border border-[rgba(59,130,246,0.2)] text-[var(--color-accent-bright)] text-xs font-medium mb-8">
            <Sparkles size={12} />
            AI-powered car mod tracker
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Your build.{" "}
            <span className="text-gradient-blue">Every detail.</span>
          </h1>

          <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed max-w-xl mx-auto mb-10">
            Track every modification, calculate your total investment, visualize your dream build with AI,
            and connect with the enthusiast community.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 h-12 px-8 rounded-[10px] bg-[var(--color-accent)] text-white font-semibold text-base hover:bg-[var(--color-accent-hover)] transition-all active:scale-[0.97] glow-accent"
            >
              Start for free
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/community"
              className="flex items-center gap-2 h-12 px-8 rounded-[10px] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] font-semibold text-base border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-all active:scale-[0.97]"
            >
              Browse builds
            </Link>
          </div>
        </div>

        {/* Hero visual */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1 shadow-2xl">
            <div className="rounded-[16px] bg-[var(--color-bg-elevated)] p-6 min-h-[280px] flex items-center justify-center relative overflow-hidden">
              {/* Decorative grid */}
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage:
                    "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              {/* Mock dashboard */}
              <div className="relative w-full max-w-2xl grid grid-cols-3 gap-3">
                {[
                  { label: "Total Spent", value: "$14,230", accent: true },
                  { label: "Mods Installed", value: "23" },
                  { label: "Wishlist Items", value: "8" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-[12px] p-4 border ${
                      stat.accent
                        ? "bg-[var(--color-accent-muted)] border-[rgba(59,130,246,0.3)]"
                        : "bg-[var(--color-bg-card)] border-[var(--color-border)]"
                    }`}
                  >
                    <p className="text-[10px] text-[var(--color-text-muted)] mb-1">{stat.label}</p>
                    <p
                      className={`text-xl font-bold ${
                        stat.accent ? "text-[var(--color-accent-bright)]" : ""
                      }`}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
                <div className="col-span-3 rounded-[12px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4">
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-3">Recent Mods</p>
                  <div className="space-y-2">
                    {[
                      { name: "Akrapovič Exhaust System", cat: "Exhaust", cost: "$2,800", color: "#94a3b8" },
                      { name: "KW Coilover V3", cat: "Suspension", cost: "$1,600", color: "#8b5cf6" },
                      { name: "Carbon Fiber Front Splitter", cat: "Aero", cost: "$890", color: "#06b6d4" },
                    ].map((mod) => (
                      <div key={mod.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: mod.color }}
                          />
                          <span className="text-xs text-[var(--color-text-primary)]">{mod.name}</span>
                        </div>
                        <span className="text-xs font-medium text-[var(--color-accent-bright)]">{mod.cost}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-12 px-4 border-y border-[var(--color-border)]">
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-gradient-blue">{s.value}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Everything your build needs
            </h2>
            <p className="text-[var(--color-text-secondary)] max-w-md mx-auto">
              From your first mod to a full track build — MODVAULT has the tools to document and share your journey.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, description, color }) => (
              <div
                key={title}
                className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 card-hover"
              >
                <div
                  className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                >
                  <Icon size={18} style={{ color }} aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-sm mb-2">{title}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="rounded-[24px] border border-[rgba(59,130,246,0.2)] bg-[var(--color-accent-muted)] p-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Ready to document your build?
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-8 max-w-sm mx-auto">
              Join enthusiasts tracking every bolt, mod, and milestone.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-[10px] bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] transition-all active:scale-[0.97] glow-accent"
            >
              Create free account
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--color-border)] py-8 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs tracking-wider text-[var(--color-text-muted)]">
              MODVAULT
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Built for enthusiasts.
          </p>
        </div>
      </footer>
    </main>
  );
}
