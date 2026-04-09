"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Car {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  color: string | null;
  is_primary: boolean;
}

interface AliveCard {
  id: string;
  pixel_card_url: string;
  car_label: string;
}

type Stage =
  | "loading"
  | "has_alive"          // show card + burn CTA
  | "burning"            // burn API in-flight / animation playing
  | "burned_last_words"  // showing last words (ghost state)
  | "mint_form"          // no alive card, show occasion form
  | "minting";           // mint API in-flight

export default function MintPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [cars, setCars] = useState<Car[]>([]);
  const [aliveCard, setAliveCard] = useState<AliveCard | null>(null);

  const [selectedCarId, setSelectedCarId] = useState<string>("");
  const [occasion, setOccasion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [lastWords, setLastWords] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Initial load: fetch cars + alive card ─────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }

      const [{ data: carsRaw }, { data: aliveRaw }] = await Promise.all([
        supabase
          .from("cars")
          .select("id, year, make, model, trim, color, is_primary")
          .eq("user_id", user.id)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("pixel_cards")
          .select("id, pixel_card_url, car_snapshot")
          .eq("user_id", user.id)
          .eq("status", "alive")
          .maybeSingle(),
      ]);

      const carList = (carsRaw ?? []) as Car[];
      setCars(carList);

      if (carList.length === 0) {
        router.push("/garage");
        return;
      }

      setSelectedCarId(carList[0].id);

      if (aliveRaw) {
        const row = aliveRaw as {
          id: string;
          pixel_card_url: string;
          car_snapshot: { year: number; make: string; model: string };
        };
        const s = row.car_snapshot;
        setAliveCard({
          id: row.id,
          pixel_card_url: row.pixel_card_url,
          car_label: `${s.year} ${s.make} ${s.model}`,
        });
        setStage("has_alive");
      } else {
        setStage("mint_form");
      }
    });
  }, [router]);

  // ── Draw pixelated alive-card image to canvas ─────────────────────────
  useEffect(() => {
    if (stage !== "has_alive" && stage !== "burning" && stage !== "burned_last_words") return;
    if (!aliveCard?.pixel_card_url) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = aliveCard.pixel_card_url;

    const draw = (source: HTMLImageElement) => {
      const aspect = source.naturalHeight / (source.naturalWidth || 1);
      const PX = 64;
      const PY = Math.round(PX * aspect);
      const tiny = document.createElement("canvas");
      tiny.width = PX;
      tiny.height = PY;
      const tctx = tiny.getContext("2d");
      if (!tctx) return;
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(source, 0, 0, PX, PY);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tiny, 0, 0, canvas.width, canvas.height);
    };

    img.onload = () => draw(img);
    img.onerror = () => {
      const fallback = new window.Image();
      fallback.src = aliveCard.pixel_card_url!;
      fallback.onload = () => draw(fallback);
    };
  }, [aliveCard?.pixel_card_url, stage]);

  // ── Burn flow ────────────────────────────────────────────────────────
  async function handleBurn() {
    if (!aliveCard) return;
    setError(null);
    setStage("burning");
    try {
      const res = await fetch("/api/cards/burn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: aliveCard.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Burn failed");
      const words = typeof json.last_words === "string" ? json.last_words : "It was a good run.";
      setLastWords(words);
      // Show last words for 3.5s, then move to mint form
      setStage("burned_last_words");
      setTimeout(() => {
        setAliveCard(null);
        setStage("mint_form");
      }, 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Burn failed");
      setStage("has_alive");
    }
  }

  // ── Mint flow (generate then mint) ───────────────────────────────────
  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCarId) return;
    const occ = occasion.trim();
    if (!occ) { setError("Tell us the occasion."); return; }
    setError(null);
    setStage("minting");
    try {
      const genRes = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: selectedCarId, occasion: occ }),
      });
      const genJson = await genRes.json();
      if (!genRes.ok) throw new Error(genJson.error ?? "Generation failed");

      const mintRes = await fetch("/api/cards/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: selectedCarId,
          occasion: occ,
          cardTitle: genJson.cardTitle,
          buildArchetype: genJson.buildArchetype,
          estimatedPerformance: genJson.estimatedPerformance,
          aiEstimatedPerformance: genJson.aiEstimatedPerformance,
          buildAggression: genJson.buildAggression,
          uniquenessScore: genJson.uniquenessScore,
          authenticityConfidence: genJson.authenticityConfidence,
          traits: genJson.traits,
          flavourText: genJson.flavourText,
          weaknesses: genJson.weaknesses,
          rivalArchetypes: genJson.rivalArchetypes,
        }),
      });
      const mintJson = await mintRes.json();
      if (!mintRes.ok) throw new Error(mintJson.error ?? "Mint failed");

      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed");
      setStage("mint_form");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-64px)]">
        <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  // ── HAS ALIVE CARD: show card + burn button ─────────────────────────
  if (stage === "has_alive" || stage === "burning" || stage === "burned_last_words") {
    const CARD_W = 280;
    const CARD_H = Math.round(CARD_W * 1.4);
    const isBurning = stage === "burning" || stage === "burned_last_words";

    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-5 py-10">
        <style>{`
          @keyframes card-float {
            0%, 100% { transform: translateY(0px); }
            50%     { transform: translateY(-10px); }
          }
          @keyframes burn-shake {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            25%      { transform: translate(-2px, 1px) rotate(-1deg); }
            50%      { transform: translate(2px, -1px) rotate(1deg); }
            75%      { transform: translate(-1px, 2px) rotate(-0.5deg); }
          }
          @keyframes burn-fade {
            0%   { filter: brightness(1) saturate(1); opacity: 1; }
            35%  { filter: brightness(1.4) saturate(1.6) hue-rotate(-15deg); opacity: 1; }
            70%  { filter: brightness(0.45) saturate(0) contrast(1.4); opacity: 0.55; }
            100% { filter: brightness(0.18) saturate(0) contrast(1.6); opacity: 0.12; }
          }
          @keyframes ember-rise {
            0%   { transform: translateY(0) scale(1); opacity: 0.9; }
            100% { transform: translateY(-140px) scale(0.3); opacity: 0; }
          }
          @keyframes ash-fall {
            0%   { transform: translateY(0) rotate(0deg); opacity: 0.65; }
            100% { transform: translateY(60px) rotate(240deg); opacity: 0; }
          }
          @keyframes lastwords-in {
            0%   { opacity: 0; transform: translateY(10px); letter-spacing: 0.06em; }
            100% { opacity: 1; transform: translateY(0); letter-spacing: 0.02em; }
          }
          .float-card     { animation: card-float 3.5s ease-in-out infinite; }
          .burning-card   { animation: burn-shake 0.18s linear infinite, burn-fade 3.2s ease-out forwards; }
          .ember          { position: absolute; width: 6px; height: 6px; border-radius: 50%;
                            background: radial-gradient(circle, #fff7c8 0%, #ffb347 45%, #ff4d2d 100%);
                            box-shadow: 0 0 12px 2px rgba(255,140,60,0.7);
                            animation: ember-rise 1.8s ease-out forwards; pointer-events: none; }
          .ash            { position: absolute; width: 4px; height: 4px;
                            background: #3a3a3a; border-radius: 1px;
                            animation: ash-fall 2.4s ease-in forwards; pointer-events: none; }
          .lastwords      { animation: lastwords-in 0.8s ease-out forwards; }
        `}</style>

        <h1 className="text-[11px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] mb-8">
          {stage === "has_alive" ? "Your Living Card" : stage === "burning" ? "Burning" : "Gone"}
        </h1>

        <div style={{ position: "relative", width: CARD_W, height: CARD_H }}>
          {/* Embers overlay (burning state) */}
          {isBurning && (
            <>
              {[...Array(14)].map((_, i) => (
                <span
                  key={`e-${i}`}
                  className="ember"
                  style={{
                    left: `${10 + (i * 6.4) % 82}%`,
                    bottom: `${30 + ((i * 13) % 45)}%`,
                    animationDelay: `${(i * 0.1).toFixed(2)}s`,
                  }}
                />
              ))}
              {[...Array(10)].map((_, i) => (
                <span
                  key={`a-${i}`}
                  className="ash"
                  style={{
                    left: `${8 + (i * 9.5) % 86}%`,
                    bottom: `${10 + ((i * 11) % 40)}%`,
                    animationDelay: `${(0.6 + i * 0.15).toFixed(2)}s`,
                  }}
                />
              ))}
            </>
          )}

          <div
            className={isBurning ? "burning-card" : "float-card"}
            style={{ filter: "drop-shadow(0 20px 40px rgba(59,130,246,0.22))" }}
          >
            <canvas
              ref={canvasRef}
              width={CARD_W}
              height={CARD_H}
              style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: 16,
                imageRendering: "pixelated",
                display: "block",
              }}
              aria-label="Living card"
            />
          </div>
        </div>

        <p style={{
          marginTop: 22,
          fontFamily: "ui-monospace,monospace",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
        }}>
          {aliveCard?.car_label}
        </p>

        {/* Last words overlay */}
        {stage === "burned_last_words" && lastWords && (
          <p
            className="lastwords"
            style={{
              marginTop: 26,
              maxWidth: 360,
              fontSize: 16,
              fontWeight: 500,
              fontStyle: "italic",
              lineHeight: 1.45,
              color: "#ff8a65",
              textAlign: "center",
              textShadow: "0 0 18px rgba(255,90,40,0.4)",
              padding: "0 12px",
            }}
          >
            &ldquo;{lastWords}&rdquo;
          </p>
        )}

        {/* Burn CTA (only when has_alive) */}
        {stage === "has_alive" && (
          <>
            {error && (
              <p className="text-xs text-[var(--color-danger)] mt-5" role="alert">{error}</p>
            )}
            <p className="text-xs text-[var(--color-text-muted)] mt-6 max-w-xs text-center leading-relaxed">
              You can only have one living card at a time. Burn it to mint a new one.
            </p>
            <button
              onClick={handleBurn}
              style={{
                marginTop: 16,
                height: 48,
                padding: "0 28px",
                borderRadius: 12,
                background: "rgba(255,69,58,0.12)",
                border: "1.5px solid rgba(255,90,40,0.5)",
                color: "#ff8a65",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.02em",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <Flame size={14} aria-hidden="true" />
              Burn this card
            </button>
          </>
        )}

        {stage === "burning" && (
          <p
            style={{
              marginTop: 26,
              fontFamily: "ui-monospace,monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#ff8a65",
            }}
          >
            Last words…
          </p>
        )}
      </div>
    );
  }

  // ── MINT FORM: no living card ───────────────────────────────────────
  if (stage === "mint_form" || stage === "minting") {
    const busy = stage === "minting";
    return (
      <div className="px-5 sm:px-8 py-10 max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-tight">Mint a new card</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-2 leading-relaxed max-w-xs mx-auto">
            Your card is a living thing. It has a personality, a voice, and one life.
          </p>
        </div>

        <form onSubmit={handleMint} className="space-y-5">
          {cars.length > 1 && (
            <div>
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Which car
              </label>
              <select
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
                disabled={busy}
                className="w-full h-11 px-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm"
              >
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.year} {car.make} {car.model}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="occasion"
              className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2"
            >
              What&rsquo;s the occasion?
            </label>
            <textarea
              id="occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value.slice(0, 100))}
              placeholder="Just finished the exhaust install…"
              disabled={busy}
              rows={3}
              required
              className="w-full rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3 text-sm resize-none"
            />
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 text-right">
              {occasion.length}/100
            </p>
          </div>

          {error && (
            <p className="text-xs text-[var(--color-danger)]" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !occasion.trim()}
            className="w-full h-12 rounded-xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Minting…
              </>
            ) : (
              "Mint card"
            )}
          </button>
        </form>

        <p className="text-[10px] text-[var(--color-text-muted)] text-center mt-6">
          Need to set up a car first?{" "}
          <Link href="/garage" className="text-[var(--color-accent)] hover:text-[var(--color-accent-bright)]">
            Go to garage →
          </Link>
        </p>
      </div>
    );
  }

  return null;
}
