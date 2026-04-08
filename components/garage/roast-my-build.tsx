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
        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl font-bold text-xs"
        style={{
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
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
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9990,
            background: "rgba(3,3,10,0.92)",
            backdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            animation: "rfFade 220ms ease-out",
          }}
        >
          <style>{`@keyframes rfFade { from { opacity: 0 } to { opacity: 1 } }
          @keyframes rfUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }`}</style>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 600,
              width: "100%",
              borderRadius: 22,
              padding: 28,
              background: "linear-gradient(135deg, rgba(15,12,30,0.95) 0%, rgba(18,15,35,0.92) 100%)",
              border: "1px solid rgba(255,159,10,0.35)",
              boxShadow: "0 40px 120px rgba(0,0,0,0.7), 0 0 60px rgba(255,69,58,0.15)",
              animation: "rfUp 320ms cubic-bezier(0.34,1.56,0.64,1)",
              position: "relative",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #ff453a 0%, #ff9f0a 100%)",
                  boxShadow: "0 0 26px rgba(255,159,10,0.5)",
                }}
              >
                <Flame size={20} color="#fff" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white">Roast my build</h2>
                <p className="text-xs" style={{ color: "rgba(200,180,240,0.55)" }}>
                  {carLabel}
                </p>
              </div>
            </div>

            {/* Body */}
            <div
              style={{
                minHeight: 200,
                padding: 20,
                borderRadius: 14,
                background: "rgba(5,5,12,0.6)",
                border: "1px solid rgba(168,85,247,0.18)",
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                lineHeight: 1.75,
                color: "rgba(230,220,255,0.88)",
                whiteSpace: "pre-wrap",
              }}
            >
              {loading && (
                <div className="flex items-center gap-3 text-sm" style={{ color: "rgba(200,180,240,0.65)" }}>
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
                <div style={{ color: "rgba(200,180,240,0.4)" }}>Click generate to begin.</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={copy}
                disabled={!roast}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background: "rgba(15,12,30,0.6)",
                  border: "1px solid rgba(168,85,247,0.3)",
                  color: "#e9d5ff",
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
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
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
