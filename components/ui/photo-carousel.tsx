"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface CarouselPhoto {
  id: string;
  url: string;
  caption?: string;
}

interface PhotoCarouselProps {
  photos: CarouselPhoto[];
  /** Called when the displayed index changes (optional). */
  onIndexChange?: (index: number) => void;
  /** Aspect ratio of slides. Defaults to "16/9". */
  aspectRatio?: string;
  /** Class applied to each image element. */
  imageClassName?: string;
  /** Initial index to start at. */
  initialIndex?: number;
  /** Override width of dots wrapper. */
  className?: string;
  /** Rounded corners style. */
  rounded?: string;
  /** Show dots indicator. Defaults true. */
  showDots?: boolean;
  /** Show arrow buttons on desktop. Defaults true. */
  showArrows?: boolean;
  /** Render extra content on top of each slide (cover badge, action buttons). */
  renderOverlay?: (photo: CarouselPhoto, index: number) => React.ReactNode;
  /** When user taps the current photo. */
  onPhotoClick?: (photo: CarouselPhoto, index: number) => void;
}

/**
 * Lightweight swipeable photo carousel.
 * - Touch swipe with momentum (uses velocity from pointer events)
 * - Arrow buttons on desktop
 * - Dot indicators at the bottom
 * - Keyboard arrows when focused
 *
 * Zero dependencies — no embla or swiper required.
 */
export function PhotoCarousel({
  photos,
  onIndexChange,
  aspectRatio = "16/9",
  imageClassName = "",
  initialIndex = 0,
  className = "",
  rounded = "rounded-2xl",
  showDots = true,
  showArrows = true,
  renderOverlay,
  onPhotoClick,
}: PhotoCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(photos.length - 1, 0)));
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef(0);
  const startTime = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const pointerActive = useRef(false);

  // Clamp index if photos list changes length.
  useEffect(() => {
    if (index >= photos.length && photos.length > 0) setIndex(photos.length - 1);
  }, [photos.length, index]);

  // Fire onIndexChange when index changes.
  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const goTo = useCallback((target: number) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, target));
    setIndex(clamped);
  }, [photos.length]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Pointer handlers — single handler supports both touch and mouse drag.
  function handlePointerDown(e: React.PointerEvent) {
    pointerActive.current = true;
    setDragging(true);
    startX.current = e.clientX;
    startTime.current = Date.now();
    lastX.current = e.clientX;
    lastTime.current = Date.now();
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointerActive.current) return;
    const dx = e.clientX - startX.current;
    setDragOffset(dx);
    lastX.current = e.clientX;
    lastTime.current = Date.now();
  }

  function handlePointerUp() {
    if (!pointerActive.current) return;
    pointerActive.current = false;
    setDragging(false);
    const dx = dragOffset;
    const dt = Math.max(1, lastTime.current - startTime.current);
    const velocity = dx / dt; // px per ms
    const width = trackRef.current?.clientWidth ?? 1;
    const threshold = width * 0.18;

    // Treat fast flicks as instant swipe, regardless of distance.
    const isFastFlick = Math.abs(velocity) > 0.45;

    if (dx < -threshold || (isFastFlick && dx < 0)) {
      next();
    } else if (dx > threshold || (isFastFlick && dx > 0)) {
      prev();
    }
    setDragOffset(0);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  }

  if (photos.length === 0) return null;

  return (
    <div className={`relative w-full ${className}`}>
      <div
        ref={trackRef}
        tabIndex={0}
        role="region"
        aria-label="Photo carousel"
        aria-roledescription="carousel"
        onKeyDown={handleKey}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative overflow-hidden ${rounded} touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]`}
        style={{ aspectRatio }}
      >
        <div
          className="flex h-full w-full"
          style={{
            transform: `translate3d(calc(${-index * 100}% + ${dragOffset}px), 0, 0)`,
            transition: dragging ? "none" : "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="relative flex-shrink-0 h-full w-full"
              style={{ width: "100%" }}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${photos.length}`}
              aria-hidden={i !== index}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption ?? `Photo ${i + 1}`}
                className={`h-full w-full object-cover pointer-events-none ${imageClassName}`}
                draggable={false}
                loading={i === index ? "eager" : "lazy"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!dragging && Math.abs(dragOffset) < 5) onPhotoClick?.(photo, i);
                }}
                style={{ pointerEvents: "auto" }}
              />
              {renderOverlay?.(photo, i)}
            </div>
          ))}
        </div>
      </div>

      {/* Arrow buttons (desktop) */}
      {showArrows && photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            aria-label="Previous photo"
            className="hidden sm:flex absolute top-1/2 left-3 -translate-y-1/2 min-w-[44px] min-h-[44px] w-11 h-11 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white hover:bg-black/75 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={index >= photos.length - 1}
            aria-label="Next photo"
            className="hidden sm:flex absolute top-1/2 right-3 -translate-y-1/2 min-w-[44px] min-h-[44px] w-11 h-11 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white hover:bg-black/75 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {showDots && photos.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none z-10">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to photo ${i + 1}`}
              className="pointer-events-auto rounded-full transition-all cursor-pointer"
              style={{
                width: i === index ? 22 : 6,
                height: 6,
                backgroundColor: i === index ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
