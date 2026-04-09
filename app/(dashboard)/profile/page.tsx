"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  username: string;
  avatar_url: string | null;
  created_at: string;
}

interface Card {
  id: string;
  pixel_card_url: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [mintCount, setMintCount] = useState(0);
  const [latestCard, setLatestCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }

      const [profileRes, countRes, cardRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, avatar_url, created_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("pixel_cards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("pixel_cards")
          .select("id, pixel_card_url")
          .eq("user_id", user.id)
          .order("minted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setProfile(profileRes.data as Profile | null);
      setMintCount(countRes.count ?? 0);
      setLatestCard(cardRes.data as Card | null);
      setLoading(false);
    });
  }, [router]);

  // Pixelate the card image onto the canvas
  useEffect(() => {
    if (!latestCard?.pixel_card_url || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = latestCard.pixel_card_url;

    img.onload = () => {
      const aspect = img.naturalHeight / (img.naturalWidth || 1);
      const PX = 64;
      const PY = Math.round(PX * aspect);

      const tiny = document.createElement("canvas");
      tiny.width = PX;
      tiny.height = PY;
      const tctx = tiny.getContext("2d");
      if (!tctx) return;
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(img, 0, 0, PX, PY);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tiny, 0, 0, canvas.width, canvas.height);
    };
  }, [latestCard?.pixel_card_url]);

  if (loading) {
    return (
      <div className="px-5 sm:px-8 py-10 max-w-sm mx-auto space-y-3">
        <div className="skeleton h-20 w-20 rounded-2xl mx-auto" />
        <div className="skeleton h-6 w-40 rounded-xl mx-auto" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  const CARD_W = 160;
  const CARD_H = Math.round(CARD_W * 1.4);

  return (
    <div className="px-5 sm:px-8 py-10 max-w-sm mx-auto flex flex-col items-center gap-6">

      {/* Avatar */}
      <div
        className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #3B82F6, #60A5FA)" }}
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-3xl font-black text-white uppercase select-none">
            {profile?.username?.[0] ?? "?"}
          </span>
        )}
      </div>

      {/* Username */}
      <div className="text-center">
        <p className="text-xl font-black tracking-tight">
          @{profile?.username ?? "—"}
        </p>
      </div>

      {/* Card preview */}
      {latestCard ? (
        <div style={{ filter: "drop-shadow(0 8px 24px rgba(59,130,246,0.2))" }}>
          {latestCard.pixel_card_url ? (
            <canvas
              ref={canvasRef}
              width={CARD_W}
              height={CARD_H}
              style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: 12,
                imageRendering: "pixelated",
                display: "block",
              }}
              aria-label="Your latest card"
            />
          ) : (
            <div
              style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: 12,
                background: "linear-gradient(158deg, #111, #1a1a1a)",
                border: "1px solid rgba(59,130,246,0.25)",
              }}
            />
          )}
        </div>
      ) : (
        <div
          style={{
            width: CARD_W,
            height: CARD_H,
            borderRadius: 12,
            border: "2px dashed rgba(59,130,246,0.25)",
            background: "rgba(59,130,246,0.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontFamily: "ui-monospace,monospace",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.18)",
            }}
          >
            No card yet
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-8 text-center">
        <div>
          <p className="text-2xl font-black tabular">{mintCount}</p>
          <p
            style={{
              fontFamily: "ui-monospace,monospace",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              marginTop: 3,
            }}
          >
            {mintCount === 1 ? "Card minted" : "Cards minted"}
          </p>
        </div>
        {joinDate && (
          <div>
            <p className="text-sm font-bold">{joinDate}</p>
            <p
              style={{
                fontFamily: "ui-monospace,monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                marginTop: 3,
              }}
            >
              Joined
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
