"use client";

import { useState } from "react";
import { Flame, X, RefreshCw, Copy, Check } from "lucide-react";

interface RoastMyBuildProps {
  carId: string;
  carLabel: string;
}

export function RoastMyBuild({ carId, carLabel }: RoastMyBuildProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roast, setRoast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setRoast(null);
    setCopied(false);
    try {
      const res = await fetch("/api/ai/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: carId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { roast: string };
      setRoast(data.roast);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    if (!roast) void generate();
  }

  function copy() {
    if (!roast) return;
    navigator.clipboard.writeText(roast).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl font-bold text-xs uppercase tracking-[0.1em]"
        style={{
          fontFamily: "ui-monospace, monospace",
          background: "linear-gradient(135deg, #ff453a 0%, #ff9f0a 100%)",
          color: "#fff",
          border: "1px solid rgba(255,159,10,0.55)",
          boxShadow: "0 6px 24px rgba(255,69,58,0.35)",
          cursor: "pointer",
        }}
      >
        <Flame size={13} />
        Roast my build
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[9990] flex items-center justify-center p-5 animate-fade"
          style={{
            background: "var(--color-bg-glass)",
            backdropFilter: "blur(14px)",
          }}
        >
          <style>{`
            @keyframes rfUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
          `}</style>

          <div
            onClick={(e) => e.stopPropagation()}
            className="mv-panel-bright relative w-full rounded-[22px]"
            style={{
              maxWidth: 600,
              padding: 28,
              borderColor: "rgba(255,159,10,0.35)",
              boxShadow: "0 40px 120px rgba(0,0,0,0.55), 0 0 60px rgba(255,69,58,0.15)",
              animation: "rfUp 320ms cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer"
              style={{
                background: "var(--mv-panel-bg)",
                border: "1px solid var(--mv-panel-border)",
                color: "var(--mv-panel-text-muted)",
              }}
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #ff453a 0%, #ff9f0a 100%)",
                  boxShadow: "0 0 26px rgba(255,159,10,0.5)",
                }}
              >
                <Flame size={20} color="#fff" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight mv-text">Roast my build</h2>
                <p className="text-xs mv-text-muted">{carLabel}</p>
              </div>
            </div>

            {/* Body */}
            <div
              className="mv-panel rounded-2xl p-5 mv-text-soft"
              style={{
                minHeight: 200,
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                lineHeight: 1.75,
                whiteSpace: "pre-wrap",
              }}
            >
              {loading && (
                <div className="flex items-center gap-3 text-sm mv-text-muted">
                  <RefreshCw size={14} className="animate-spin" />
                  Sharpening the knives…
                </div>
              )}
              {error && (
                <div style={{ color: "#ff9f0a" }}>
                  Something broke: {error}
                </div>
              )}
              {!loading && !error && roast && <div>{roast}</div>}
              {!loading && !error && !roast && (
                <div className="mv-text-dim">Click generate to begin.</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={copy}
                disabled={!roast}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-[0.1em] mv-panel mv-text-accent"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  cursor: roast ? "pointer" : "not-allowed",
                  opacity: roast ? 1 : 0.4,
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={generate}
                disabled={loading}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-[0.1em]"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  background: "linear-gradient(135deg, #ff453a 0%, #ff9f0a 100%)",
                  color: "#fff",
                  border: "1px solid rgba(255,159,10,0.55)",
                  boxShadow: "0 4px 18px rgba(255,69,58,0.4)",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <RefreshCw size={12} />
                {loading ? "Roasting…" : roast ? "Another one" : "Generate roast"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
