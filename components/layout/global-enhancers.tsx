"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

const VTEC_TARGET = "vtec";

/**
 * Global keyboard shortcuts:
 *   G → garage
 *   F → forum
 *   C → chat
 *   V → visualizer
 *   S → stats
 *   P → profile
 *   ? → show shortcut overlay
 *
 * Plus the VTEC easter egg: type 'vtec' anywhere and the screen flashes
 * with a redline burst and sound effect (visual only, no audio).
 *
 * Plus the one-time page reveal animation on first mount.
 */
export function GlobalEnhancers() {
  const router = useRouter();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [vtecActive, setVtecActive] = useState(false);
  const [showReveal, setShowReveal] = useState(true);

  // Page reveal — fires once per page load
  useEffect(() => {
    const t = setTimeout(() => setShowReveal(false), 950);
    return () => clearTimeout(t);
  }, []);

  // Keyboard shortcuts + VTEC buffer
  useEffect(() => {
    let buffer = "";
    let bufferTimer: ReturnType<typeof setTimeout> | null = null;

    function isTextInput(target: EventTarget | null): boolean {
      if (!target) return false;
      const el = target as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || el.isContentEditable === true;
    }

    function handler(e: KeyboardEvent) {
      // ? — show shortcuts (allow even outside inputs)
      if (e.key === "?" && !isTextInput(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      // ESC closes shortcut overlay
      if (e.key === "Escape" && showShortcuts) {
        setShowShortcuts(false);
        return;
      }

      // Don't trigger shortcuts inside form fields
      if (isTextInput(e.target)) return;

      // VTEC buffer
      if (/^[a-zA-Z]$/.test(e.key)) {
        buffer = (buffer + e.key.toLowerCase()).slice(-VTEC_TARGET.length);
        if (bufferTimer) clearTimeout(bufferTimer);
        bufferTimer = setTimeout(() => {
          buffer = "";
        }, 1500);

        if (buffer === VTEC_TARGET) {
          buffer = "";
          setVtecActive(true);
          setTimeout(() => setVtecActive(false), 2200);
          if ("vibrate" in navigator) navigator.vibrate([20, 40, 80]);
          return;
        }
      }

      // Single-key shortcuts (no modifiers)
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const map: Record<string, string> = {
        g: "/garage",
        // f is reserved for card flip when the card viewer is open
        c: "/chat",
        p: "/profile",
      };
      const route = map[e.key.toLowerCase()];
      if (route) {
        e.preventDefault();
        router.push(route);
      }
    }

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      if (bufferTimer) clearTimeout(bufferTimer);
    };
  }, [router, showShortcuts]);

  const shortcuts: { key: string; label: string }[] = [
    { key: "G", label: "Garage" },
    { key: "V", label: "Visualizer" },
    { key: "C", label: "AI Chat" },
    { key: "S", label: "Stats" },
    { key: "P", label: "Profile" },
    { key: "F", label: "Flip card (in viewer)" },
    { key: "?", label: "Show shortcuts" },
  ];

  return (
    <>
      {/* Page reveal */}
      {showReveal && <div className="page-reveal" aria-hidden="true" />}

      {/* VTEC easter egg */}
      {vtecActive && (
        <div
          className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center"
          style={{ animation: "fadeIn 200ms ease both" }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-radial" style={{
            background: "radial-gradient(ellipse at center, rgba(255,69,58,0.35) 0%, rgba(0,0,0,0) 60%)",
          }} />
          <div className="relative flex flex-col items-center gap-3" style={{ animation: "scaleIn 250ms cubic-bezier(0.16, 1, 0.3, 1) both" }}>
            <Zap size={120} className="text-[#ff453a]" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 24px rgba(255,69,58,0.6))" }} />
            <div className="text-center">
              <p className="text-6xl font-black tracking-tighter" style={{
                background: "linear-gradient(135deg, #fbbf24, #ff9f0a, #ff453a)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow: "0 0 60px rgba(251,191,36,0.5)",
              }}>VTEC</p>
              <p className="text-sm font-bold text-white/80 tracking-[0.3em] mt-2">JUST KICKED IN, YO</p>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcut overlay */}
      {showShortcuts && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm animate-fade"
            onClick={() => setShowShortcuts(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-5 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-scale-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold">Keyboard Shortcuts</h2>
                <kbd className="text-[10px] px-2 py-1 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] font-mono">ESC</kbd>
              </div>
              <div className="space-y-2.5">
                {shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">{s.label}</span>
                    <kbd className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] min-w-[32px] text-center">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
                <p className="text-[10px] text-[var(--color-text-muted)] text-center">
                  Type <span className="font-mono font-bold text-[#ff9f0a]">VTEC</span> anywhere for a surprise.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
