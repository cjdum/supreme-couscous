import Link from "next/link";
import { ArrowRight, Wrench, Sparkles, GalleryHorizontal, Zap, Award, Gauge } from "lucide-react";

export const metadata = {
  title: "MODVAULT — The permanent home for your build",
  description:
    "Track every mod. Visualize with AI. Mint pixel cards that freeze your build forever. MODVAULT is the permanent home for car enthusiasts.",
};

export default function LandingPage() {
  return (
    <main
      className="min-h-dvh relative overflow-x-hidden"
      style={{
        backgroundColor: "#05050c",
        color: "#f4f0ff",
      }}
    >
      {/* ── Ambient background: purple nebula + pixel grid ─────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(168,85,247,0.28) 0%, transparent 60%)",
            "radial-gradient(ellipse 60% 40% at 20% 40%, rgba(91,33,182,0.22) 0%, transparent 60%)",
            "radial-gradient(ellipse 60% 40% at 85% 70%, rgba(59,130,246,0.18) 0%, transparent 60%)",
            "linear-gradient(180deg, #05050c 0%, #08061a 50%, #05050c 100%)",
          ].join(", "),
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(168,85,247,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 80%)",
        }}
      />

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-lg"
        style={{
          background: "rgba(5,5,12,0.6)",
          borderBottom: "1px solid rgba(168,85,247,0.15)",
        }}
      >
        <div className="flex items-center justify-between h-16 px-5 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                boxShadow: "0 0 18px rgba(168,85,247,0.5)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <span
              className="font-black text-sm uppercase"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.2em", color: "#fff" }}
            >
              MODVAULT
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="h-9 px-4 text-sm font-bold rounded-lg flex items-center transition-colors"
              style={{ color: "rgba(220,210,250,0.75)" }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="h-9 px-5 text-sm font-bold rounded-lg flex items-center transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                boxShadow: "0 4px 18px rgba(168,85,247,0.4)",
                color: "#fff",
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 pt-40 pb-24 px-5">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{
              background: "rgba(168,85,247,0.12)",
              border: "1px solid rgba(168,85,247,0.35)",
              boxShadow: "0 0 18px rgba(168,85,247,0.18)",
            }}
          >
            <Sparkles size={13} style={{ color: "#d8b4fe" }} />
            <span
              className="text-[11px] font-bold uppercase"
              style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.18em", color: "#e9d5ff" }}
            >
              Permanent vault for your build
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-black tracking-tight leading-[0.95] mb-8"
            style={{
              fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
            }}
          >
            <span style={{ color: "#fff" }}>Every mod.</span>
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #c4b5fd 0%, #a855f7 50%, #7b4fd4 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 0 60px rgba(168,85,247,0.3)",
              }}
            >
              Frozen forever.
            </span>
          </h1>

          <p
            className="text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-12"
            style={{ color: "rgba(220,210,250,0.7)" }}
          >
            Track every bolt, dollar, and detail of your build. Visualize it with AI. Then{" "}
            <span style={{ color: "#e9d5ff", fontWeight: 700 }}>mint a pixel card</span> that freezes the moment
            forever — like a trading card for your car.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 h-14 px-10 rounded-xl font-bold text-base transition-all active:scale-[0.97] w-full sm:w-auto justify-center"
              style={{
                background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                boxShadow: "0 8px 36px rgba(168,85,247,0.55), inset 0 1px 0 rgba(255,255,255,0.2)",
                color: "#fff",
                border: "1px solid rgba(168,85,247,0.6)",
              }}
            >
              Start your vault
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 h-14 px-10 rounded-xl font-bold text-base transition-all active:scale-[0.97] w-full sm:w-auto justify-center"
              style={{
                background: "rgba(15,12,30,0.6)",
                border: "1px solid rgba(168,85,247,0.25)",
                color: "#e9d5ff",
                backdropFilter: "blur(8px)",
              }}
            >
              Sign in
            </Link>
          </div>

          {/* Tiny trust line */}
          <p
            className="mt-8 text-[11px] font-bold uppercase"
            style={{
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.22em",
              color: "rgba(160,140,200,0.55)",
            }}
          >
            Free forever · No card required · Your data stays yours
          </p>
        </div>

        {/* ── Hero visual: a giant mock pixel card ───────────────────── */}
        <div className="mt-20 max-w-md mx-auto relative">
          <div
            aria-hidden
            className="absolute -inset-10 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, rgba(168,85,247,0.35) 0%, transparent 60%)",
              filter: "blur(40px)",
            }}
          />
          <div
            className="relative rounded-[22px] overflow-hidden"
            style={{
              border: "2px solid rgba(245,215,110,0.5)",
              boxShadow:
                "0 0 40px rgba(168,85,247,0.45), 0 30px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)",
              background: "linear-gradient(158deg, #0e0e1c 0%, #110f1d 55%, #09090f 100%)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 h-12"
              style={{ background: "rgba(5,5,12,0.85)", borderBottom: "1px solid rgba(123,79,212,0.2)" }}
            >
              <span
                className="text-[11px] font-black uppercase"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em", color: "rgba(200,180,240,0.85)" }}
              >
                SUPRA MK4
              </span>
              <span
                className="text-[10px] font-black px-2 py-1 rounded"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  background: "rgba(168,85,247,0.18)",
                  border: "1px solid rgba(168,85,247,0.5)",
                  color: "#e9d5ff",
                  letterSpacing: "0.12em",
                }}
              >
                #0001
              </span>
            </div>

            {/* Art zone */}
            <div
              className="relative flex items-center justify-center"
              style={{ height: 240, background: "rgba(5,5,12,0.65)" }}
            >
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: "radial-gradient(ellipse at 50% 65%, rgba(168,85,247,0.35) 0%, transparent 70%)",
                }}
              />
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: "80%",
                  height: "80%",
                  borderRadius: 10,
                  border: "2px solid rgba(168,85,247,0.6)",
                  background:
                    "linear-gradient(135deg, rgba(123,79,212,0.2) 0%, rgba(59,130,246,0.12) 100%)",
                  boxShadow: "0 0 20px rgba(168,85,247,0.4)",
                }}
              >
                <Gauge size={72} style={{ color: "rgba(200,180,240,0.4)" }} />
              </div>
            </div>

            {/* Era strip */}
            <div
              className="flex items-center justify-center py-2"
              style={{
                background: "rgba(5,5,12,0.92)",
                borderTop: "1px solid rgba(123,79,212,0.2)",
                borderBottom: "1px solid rgba(123,79,212,0.2)",
              }}
            >
              <div
                className="flex items-center gap-2 px-4 py-1 rounded-full"
                style={{
                  background: "rgba(168,85,247,0.15)",
                  border: "1px solid rgba(168,85,247,0.5)",
                  boxShadow: "0 0 10px rgba(168,85,247,0.35)",
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#e9d5ff", boxShadow: "0 0 6px #e9d5ff" }}
                />
                <span
                  className="text-[10px] font-black uppercase"
                  style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.22em", color: "#e9d5ff" }}
                >
                  Neon Era
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div
              className="grid grid-cols-5 gap-1 px-3 py-3"
              style={{ background: "rgba(7,7,14,0.78)" }}
            >
              {[
                { l: "HP", v: "720" },
                { l: "TRQ", v: "680" },
                { l: "0-60", v: "2.8s" },
                { l: "MODS", v: "47" },
                { l: "SPENT", v: "$82k" },
              ].map((s) => (
                <div key={s.l} className="flex flex-col items-center gap-0.5">
                  <span
                    className="text-[8px] font-bold uppercase"
                    style={{ fontFamily: "ui-monospace, monospace", color: "rgba(160,140,200,0.5)", letterSpacing: "0.1em" }}
                  >
                    {s.l}
                  </span>
                  <span
                    className="text-sm font-black"
                    style={{ fontFamily: "ui-monospace, monospace", color: "rgba(238,228,255,0.95)" }}
                  >
                    {s.v}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-center py-3"
              style={{ background: "rgba(5,5,12,0.94)" }}
            >
              <span
                className="text-sm font-black uppercase"
                style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.1em", color: "#f5d76e" }}
              >
                GODZILLA
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature strip: Track → Visualize → Mint ─────────────────── */}
      <section className="relative z-10 py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p
              className="text-[11px] font-bold uppercase mb-3"
              style={{
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.22em",
                color: "rgba(200,180,240,0.55)",
              }}
            >
              — The vault workflow —
            </p>
            <h2
              className="font-black leading-tight"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", color: "#fff" }}
            >
              Three steps. One permanent record.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                icon: Wrench,
                title: "Track every mod",
                desc: "Log installs with cost, date, shop, photos, and notes. Auto-calculated totals by category. Your complete build history.",
              },
              {
                num: "02",
                icon: Zap,
                title: "Visualize with AI",
                desc: "Describe a dream mod in plain text. Get photorealistic renders on your actual car. Iterate freely before you buy.",
              },
              {
                num: "03",
                icon: GalleryHorizontal,
                title: "Mint a pixel card",
                desc: "Freeze your build at any milestone. Each card is a permanent trading-card-style snapshot — your stats, your era, your story.",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="relative rounded-2xl p-7"
                style={{
                  background: "rgba(15,12,30,0.55)",
                  border: "1px solid rgba(168,85,247,0.22)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
                }}
              >
                <span
                  className="absolute top-5 right-5 text-[10px] font-black"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.15em",
                    color: "rgba(168,85,247,0.4)",
                  }}
                >
                  {step.num}
                </span>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: "linear-gradient(135deg, rgba(123,79,212,0.3) 0%, rgba(168,85,247,0.2) 100%)",
                    border: "1px solid rgba(168,85,247,0.5)",
                    boxShadow: "0 0 18px rgba(168,85,247,0.3)",
                  }}
                >
                  <step.icon size={20} style={{ color: "#e9d5ff" }} />
                </div>
                <h3 className="text-lg font-black mb-2" style={{ color: "#fff" }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(200,180,240,0.65)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <section className="relative z-10 py-16 px-5">
        <div className="max-w-4xl mx-auto">
          <div
            className="grid grid-cols-3 rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(168,85,247,0.25)",
              background: "rgba(15,12,30,0.6)",
              backdropFilter: "blur(8px)",
            }}
          >
            {[
              { v: "∞", l: "Mods tracked" },
              { v: "AI", l: "Powered renders" },
              { v: "100%", l: "Yours, forever" },
            ].map((s, i) => (
              <div
                key={s.l}
                className="text-center py-8 px-4"
                style={{
                  borderRight: i < 2 ? "1px solid rgba(168,85,247,0.18)" : "none",
                }}
              >
                <p
                  className="text-4xl font-black mb-1"
                  style={{
                    background: "linear-gradient(135deg, #c4b5fd 0%, #a855f7 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {s.v}
                </p>
                <p
                  className="text-[10px] font-bold uppercase"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.18em",
                    color: "rgba(200,180,240,0.6)",
                  }}
                >
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <Award size={42} className="mx-auto mb-6" style={{ color: "#f5d76e" }} />
          <h2
            className="font-black leading-tight mb-5"
            style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", color: "#fff" }}
          >
            Your build deserves a vault.
          </h2>
          <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: "rgba(220,210,250,0.65)" }}>
            Start tracking today. Mint your first card tomorrow. Look back on it in ten years.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 h-14 px-10 rounded-xl font-bold text-base transition-all active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
              boxShadow: "0 8px 36px rgba(168,85,247,0.55), inset 0 1px 0 rgba(255,255,255,0.2)",
              color: "#fff",
              border: "1px solid rgba(168,85,247,0.6)",
            }}
          >
            Create your vault
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 py-10 px-5"
        style={{ borderTop: "1px solid rgba(168,85,247,0.15)" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)" }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 9l2-5h6l2 5H2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="4.5" cy="10" r="1" fill="white" />
                <circle cx="9.5" cy="10" r="1" fill="white" />
              </svg>
            </div>
            <span
              className="text-[10px] font-black uppercase"
              style={{
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.22em",
                color: "rgba(200,180,240,0.6)",
              }}
            >
              MODVAULT
            </span>
          </div>
          <p
            className="text-[10px] uppercase"
            style={{
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.18em",
              color: "rgba(160,140,200,0.45)",
            }}
          >
            Built for enthusiasts. Made to last.
          </p>
        </div>
      </footer>
    </main>
  );
}
