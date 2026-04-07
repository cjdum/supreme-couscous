"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download, Share2, Loader2, Wrench, Zap, Award } from "lucide-react";
import { formatCurrency, getCategoryColor, getCategoryLabel } from "@/lib/utils";
import type { ModCategory } from "@/lib/supabase/types";

interface ShareCardData {
  carName: string;
  carImage: string | null;
  buildScore: number;
  buildLevel: string;
  modCount: number;
  totalInvested: number;
  topCategory: ModCategory | null;
  topMods: { name: string; category: ModCategory; cost: number | null }[];
  username: string;
}

interface CarShareCardProps {
  open: boolean;
  onClose: () => void;
  data: ShareCardData;
}

/**
 * Spotify-Wrapped style shareable card.
 * Renders a beautiful card on screen, plus a Download button that
 * exports it as a PNG via canvas (built-in, no external deps).
 */
export function CarShareCard({ open, onClose, data }: CarShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      // Render the card to canvas using SVG foreignObject trick (no external deps)
      const node = cardRef.current;
      if (!node) throw new Error("No card");

      // Get inline style + dimensions
      const width = 1080;
      const height = 1920;

      // Build a self-contained PNG via Canvas API drawing primitives
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#000000");
      bgGrad.addColorStop(0.5, "#0a0a0f");
      bgGrad.addColorStop(1, "#000000");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Try to draw car image if available
      if (data.carImage) {
        try {
          const img = await loadImage(data.carImage);
          // Cover the top half
          const imgH = height * 0.55;
          drawImageCover(ctx, img, 0, 0, width, imgH);
          // Dark overlay
          const overlay = ctx.createLinearGradient(0, imgH * 0.4, 0, imgH);
          overlay.addColorStop(0, "rgba(0,0,0,0)");
          overlay.addColorStop(1, "rgba(0,0,0,0.95)");
          ctx.fillStyle = overlay;
          ctx.fillRect(0, 0, width, imgH);
        } catch {
          // Fallback: gradient header
          const grad = ctx.createLinearGradient(0, 0, width, height * 0.55);
          grad.addColorStop(0, "rgba(59,130,246,0.2)");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height * 0.55);
        }
      }

      // MODVAULT logo top
      ctx.fillStyle = "#60A5FA";
      ctx.font = "bold 32px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("MODVAULT", 80, 100);

      // Username top right
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "500 28px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`@${data.username}`, width - 80, 100);

      // Big car name
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 88px Inter, sans-serif";
      ctx.textAlign = "left";
      const lines = wrapText(ctx, data.carName, width - 160, 88);
      lines.forEach((line, i) => {
        ctx.fillText(line, 80, height * 0.55 + 80 + i * 100);
      });

      // Build score block
      const scoreY = height * 0.72;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "600 22px Inter, sans-serif";
      ctx.fillText("BUILD SCORE", 80, scoreY);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "900 140px Inter, sans-serif";
      ctx.fillText(String(data.buildScore), 80, scoreY + 130);

      ctx.fillStyle = "#ffffff";
      ctx.font = "700 38px Inter, sans-serif";
      ctx.fillText(data.buildLevel.toUpperCase(), 80, scoreY + 180);

      // Stats row
      const statsY = height * 0.86;
      const statW = (width - 160) / 3;
      const stats = [
        { label: "MODS", value: String(data.modCount), color: "#60A5FA" },
        { label: "INVESTED", value: formatCurrency(data.totalInvested), color: "#30d158" },
        {
          label: "TOP CATEGORY",
          value: data.topCategory ? getCategoryLabel(data.topCategory) : "—",
          color: data.topCategory ? getCategoryColor(data.topCategory) : "#888",
        },
      ];
      stats.forEach((s, i) => {
        const x = 80 + i * statW;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "600 20px Inter, sans-serif";
        ctx.fillText(s.label, x, statsY);
        ctx.fillStyle = s.color;
        ctx.font = "800 44px Inter, sans-serif";
        ctx.fillText(s.value, x, statsY + 56);
      });

      // Footer
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "500 22px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Track every mod at modvault.app", width / 2, height - 60);

      // Trigger download
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      if (!blob) throw new Error("Failed to render image");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modvault-${data.carName.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({
        title: `${data.carName} on MODVAULT`,
        text: `Check out my ${data.carName} build on MODVAULT — Build Score ${data.buildScore} (${data.buildLevel})`,
        url: typeof window !== "undefined" ? `${window.location.origin}/u/${data.username}` : undefined,
      });
    } catch {
      // ignore (user cancelled)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade" onClick={onClose}>
      <div className="relative max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 w-9 h-9 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={16} className="text-white" />
        </button>

        {/* Visible card */}
        <div
          ref={cardRef}
          className="relative rounded-3xl overflow-hidden border border-[var(--color-border)] animate-scale-in"
          style={{ aspectRatio: "9/16", background: "linear-gradient(180deg, #000 0%, #0a0a0f 50%, #000 100%)" }}
        >
          {/* Car image background */}
          {data.carImage && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.carImage} alt="" className="absolute inset-0 w-full h-1/2 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black" style={{ height: "55%" }} />
            </>
          )}

          {/* Logo */}
          <div className="absolute top-5 left-5 right-5 flex items-center justify-between">
            <span className="text-xs font-bold tracking-[0.2em] text-[#60A5FA]">MODVAULT</span>
            <span className="text-[10px] font-semibold text-white/60">@{data.username}</span>
          </div>

          {/* Car name */}
          <div className="absolute left-5 right-5" style={{ top: "55%" }}>
            <p className="text-[10px] font-semibold tracking-wider text-[var(--color-text-muted)] uppercase mb-1">My Build</p>
            <h2 className="text-2xl font-black leading-tight text-white">{data.carName}</h2>
          </div>

          {/* Build score */}
          <div className="absolute left-5 right-5" style={{ top: "70%" }}>
            <div className="flex items-center gap-2 mb-1">
              <Award size={11} className="text-[var(--color-gold)]" />
              <p className="text-[9px] font-bold tracking-wider text-[var(--color-text-muted)] uppercase">Build Score</p>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black text-[var(--color-gold)] tabular">{data.buildScore}</span>
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">{data.buildLevel}</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="absolute left-5 right-5 grid grid-cols-3 gap-3" style={{ top: "85%" }}>
            <div>
              <div className="flex items-center gap-1 text-[var(--color-text-muted)] mb-0.5">
                <Wrench size={9} />
                <p className="text-[9px] font-bold uppercase tracking-wider">Mods</p>
              </div>
              <p className="text-base font-black text-[#60A5FA]">{data.modCount}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[var(--color-text-muted)] mb-0.5">
                <Zap size={9} />
                <p className="text-[9px] font-bold uppercase tracking-wider">Invested</p>
              </div>
              <p className="text-base font-black text-[var(--color-success)]">{formatCurrency(data.totalInvested)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">Top Cat.</p>
              <p
                className="text-sm font-black truncate"
                style={{ color: data.topCategory ? getCategoryColor(data.topCategory) : "#888" }}
              >
                {data.topCategory ? getCategoryLabel(data.topCategory) : "—"}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute left-0 right-0 bottom-3 text-center">
            <p className="text-[9px] font-medium text-[var(--color-text-muted)]">modvault.app</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 h-12 rounded-2xl bg-white text-black text-sm font-bold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Download PNG
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={handleNativeShare}
              className="h-12 px-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-bold text-white flex items-center gap-2 hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
            >
              <Share2 size={15} />
              Share
            </button>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-[var(--color-danger)] text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  const sr = img.width / img.height;
  const dr = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (sr > dr) {
    // image wider than dest — crop sides
    sw = img.height * dr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2); // max 2 lines
  // lineHeight is referenced in caller for spacing
  void lineHeight;
}
