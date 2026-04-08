"use client";

import { useState } from "react";
import { Copy, Check, Share2, Link2 } from "lucide-react";

interface CardShareActionsProps {
  cardId: string;
  carLabel: string;
}

export function CardShareActions({ cardId, carLabel }: CardShareActionsProps) {
  const [copied, setCopied] = useState(false);

  function getUrl(): string {
    if (typeof window === "undefined") return `/c/${cardId}`;
    return `${window.location.origin}/c/${cardId}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function tweet() {
    const text = `Check out this ${carLabel} on MODVAULT`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getUrl())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function nativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) {
      void copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `${carLabel} on MODVAULT`,
        url: getUrl(),
      });
    } catch {
      // user canceled
    }
  }

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 14px",
    borderRadius: 10,
    fontFamily: "ui-monospace, monospace",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    background: "rgba(15,12,30,0.65)",
    border: "1px solid rgba(168,85,247,0.3)",
    color: "#e9d5ff",
    cursor: "pointer",
    transition: "all 150ms ease",
  };

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      <button onClick={copyLink} style={btnStyle}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <button onClick={tweet} style={btnStyle}>
        <Share2 size={13} />
        Share
      </button>
      <button onClick={nativeShare} style={btnStyle}>
        <Link2 size={13} />
        Share via…
      </button>
    </div>
  );
}
