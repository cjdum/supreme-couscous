"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Plus, X, Star, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface Photo {
  id: string;
  url: string;
  position: number;
  is_cover: boolean;
}

interface CarGalleryProps {
  carId: string;
  initialCoverUrl: string | null;
}

export function CarGallery({ carId, initialCoverUrl }: CarGalleryProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // photo id being acted on

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`/api/cars/${carId}/photos`);
    if (res.ok) {
      const json = await res.json();
      setPhotos(json.photos ?? []);
    }
    setLoading(false);
  }, [carId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) { setError("Max 8MB per photo"); return; }
    if (!file.type.startsWith("image/")) { setError("Images only"); return; }
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const res = await fetch(`/api/cars/${carId}/photos`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      await fetchPhotos();
      router.refresh();
      // Scroll strip to end
      setTimeout(() => {
        if (stripRef.current) stripRef.current.scrollLeft = stripRef.current.scrollWidth;
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSetCover(photoId: string) {
    setActionLoading(photoId);
    try {
      await fetch(`/api/cars/${carId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_cover", photo_id: photoId }),
      });
      await fetchPhotos();
      router.refresh();
      setLightbox(null);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(photoId: string) {
    setActionLoading(photoId);
    try {
      await fetch(`/api/cars/${carId}/photos?photoId=${photoId}`, { method: "DELETE" });
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (lightbox?.id === photoId) setLightbox(null);
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }

  // Swipe navigation in lightbox
  const lightboxIndex = lightbox ? photos.findIndex((p) => p.id === lightbox.id) : -1;

  function prevPhoto() {
    if (lightboxIndex > 0) setLightbox(photos[lightboxIndex - 1]);
  }
  function nextPhoto() {
    if (lightboxIndex < photos.length - 1) setLightbox(photos[lightboxIndex + 1]);
  }

  // Close lightbox on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) setLightbox(null);
  }

  if (loading) {
    return (
      <div>
        <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider mb-2">Photos</p>
        <div className="h-20 rounded-[14px] bg-[#1a1a1a] flex items-center justify-center">
          <Loader2 size={18} className="text-[rgba(255,255,255,0.2)] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider">
          Photos {photos.length > 0 && <span className="text-[rgba(255,255,255,0.18)]">({photos.length})</span>}
        </p>
        {photos.length > 0 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-[10px] font-semibold text-[#3B82F6] hover:text-[#60A5FA] transition-colors disabled:opacity-40"
          >
            {uploading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
            Add photo
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        /* Empty state — single drop zone */
        <div
          onClick={() => fileRef.current?.click()}
          className="relative rounded-[14px] border-2 border-dashed border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] bg-[#1a1a1a] cursor-pointer transition-all"
          style={{ height: "140px" }}
        >
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={22} className="text-[#3B82F6] animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 select-none">
              <div className="w-9 h-9 rounded-full bg-[rgba(59,130,246,0.08)] flex items-center justify-center">
                <Camera size={16} className="text-[rgba(255,255,255,0.2)]" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-[rgba(255,255,255,0.4)]">Tap to add photos</p>
                <p className="text-[10px] text-[rgba(255,255,255,0.2)] mt-0.5">JPG, PNG, WebP · Max 8MB each</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Photo strip */
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightbox(photo)}
              className="relative flex-shrink-0 rounded-[10px] overflow-hidden group focus:outline-none"
              style={{ width: "96px", height: "72px", scrollSnapAlign: "start" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="Car photo"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              {photo.is_cover && (
                <div className="absolute top-1.5 left-1.5">
                  <Star size={10} fill="#fbbf24" stroke="#fbbf24" />
                </div>
              )}
            </button>
          ))}

          {/* Upload tile */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative flex-shrink-0 rounded-[10px] border-2 border-dashed border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.18)] bg-[#1a1a1a] flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ width: "72px", height: "72px", scrollSnapAlign: "start" }}
          >
            {uploading ? (
              <Loader2 size={16} className="text-[#3B82F6] animate-spin" />
            ) : (
              <Plus size={16} className="text-[rgba(255,255,255,0.3)]" />
            )}
          </button>
        </div>
      )}

      {error && <p className="mt-1.5 text-[11px] text-[#f87171]">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={handleBackdropClick}
        >
          {/* Close */}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X size={16} className="text-white" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] font-medium text-white/50">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {/* Prev / Next */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={prevPhoto}
              className="absolute left-3 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronLeft size={18} className="text-white" />
            </button>
          )}
          {lightboxIndex < photos.length - 1 && (
            <button
              type="button"
              onClick={nextPhoto}
              className="absolute right-3 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronRight size={18} className="text-white" />
            </button>
          )}

          {/* Image */}
          <div className="px-14 max-w-2xl w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt="Car photo"
              className="w-full rounded-[16px] object-contain"
              style={{ maxHeight: "65vh" }}
            />

            {/* Actions */}
            <div className="flex items-center justify-center gap-3 mt-5">
              {!lightbox.is_cover && (
                <button
                  type="button"
                  onClick={() => handleSetCover(lightbox.id)}
                  disabled={actionLoading === lightbox.id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: "rgba(251,191,36,0.12)",
                    border: "1px solid rgba(251,191,36,0.25)",
                    color: "#fbbf24",
                  }}
                >
                  {actionLoading === lightbox.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Star size={13} fill="currentColor" />
                  )}
                  Set as Cover
                </button>
              )}
              {lightbox.is_cover && (
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: "rgba(251,191,36,0.08)",
                    border: "1px solid rgba(251,191,36,0.15)",
                    color: "rgba(251,191,36,0.6)",
                  }}
                >
                  <Star size={13} fill="currentColor" />
                  Cover Photo
                </div>
              )}
              <button
                type="button"
                onClick={() => handleDelete(lightbox.id)}
                disabled={actionLoading === lightbox.id}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  color: "#f87171",
                }}
              >
                {actionLoading === lightbox.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
