"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface RenderLightboxProps {
  /** Image URL to display fullscreen */
  src: string;
  /** Alt text for the image */
  alt?: string;
  /** Whether the lightbox is open */
  open: boolean;
  /** Called when the user closes the lightbox */
  onClose: () => void;
  /** Optional caption shown below the image */
  caption?: string;
  /** Optional element rendered next to caption (e.g. action buttons) */
  actions?: React.ReactNode;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

/**
 * Reusable fullscreen render lightbox.
 *
 * - Image fills the viewport with object-fit contain
 * - Mouse wheel + pinch to zoom (1x–4x)
 * - Click-and-drag to pan when zoomed in
 * - Smooth fade/scale enter from thumbnail position
 * - Close on Escape, backdrop click, or X button
 */
export function RenderLightbox({
  src,
  alt = "Render",
  open,
  onClose,
  caption,
  actions,
}: RenderLightboxProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinchState = useRef<{ dist: number; scale: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const reset = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      reset();
    };
  }, [open, reset]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
      if (e.key === "-") setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));
      if (e.key === "0") reset();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, reset]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setScale((s) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s + delta * 4));
      if (next === MIN_SCALE) setPan({ x: 0, y: 0 });
      return next;
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (scale <= 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragStart.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    dragStart.current = null;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchState.current = { dist: Math.hypot(dx, dy), scale };
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchState.current.dist;
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchState.current.scale * ratio));
      setScale(next);
      if (next === MIN_SCALE) setPan({ x: 0, y: 0 });
    }
  }

  function onTouchEnd() {
    pinchState.current = null;
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center animate-fade"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onWheel={onWheel}
    >
      {/* Top bar — close + zoom controls */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-[11px] font-bold text-white tabular">
          {Math.round(scale * 100)}%
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))}
            disabled={scale <= MIN_SCALE}
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))}
            disabled={scale >= MAX_SCALE}
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={scale === 1 && pan.x === 0 && pan.y === 0}
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Reset zoom"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Image — fills viewport with object-fit contain */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden select-none"
        style={{ cursor: scale > 1 ? (dragStart.current ? "grabbing" : "grab") : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain animate-scale-in"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transition: dragStart.current ? "none" : "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)",
            willChange: "transform",
            touchAction: "none",
          }}
        />
      </div>

      {/* Caption + action area */}
      {(caption || actions) && (
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 flex items-end justify-between gap-4 pointer-events-none">
          {caption && (
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed max-w-xl bg-black/60 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-white/10 pointer-events-auto">
              {caption}
            </p>
          )}
          {actions && <div className="flex gap-2 pointer-events-auto ml-auto">{actions}</div>}
        </div>
      )}
    </div>
  );
}
