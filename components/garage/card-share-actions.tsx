"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";

interface CardShareActionsProps {
  cardId: string;
  carLabel: string;
}

export function CardShareActions({ cardId, carLabel }: CardShareActionsProps) {
  const [copied, setCopied] = useState(false);

  function getUrl(): string {
    if (typeof window === "undefined") return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/c/${cardId}`;
    return `${window.location.origin}/c/${cardId}`;
  }

  async function handleShare() {
    const url = getUrl();
    const shareData = {
      title: `${carLabel} — MODVAULT`,
      text: `Check out this build on MODVAULT`,
      url,
    };

    // Mobile: use Web Share API if available
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled — don't fall through to clipboard
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    // Desktop fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API blocked — try legacy approach
      const el = document.createElement("textarea");
      el.value = url;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 18px",
        borderRadius: 10,
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: copied ? "rgba(48,209,88,0.15)" : "rgba(15,12,30,0.65)",
        border: `1px solid ${copied ? "rgba(48,209,88,0.45)" : "rgba(168,85,247,0.3)"}`,
        color: copied ? "#30d158" : "#e9d5ff",
        cursor: "pointer",
        transition: "all 200ms ease",
      }}
      aria-label={copied ? "Link copied" : "Share card"}
    >
      {copied ? <Check size={13} /> : <Share2 size={13} />}
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
