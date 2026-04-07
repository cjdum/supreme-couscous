"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera, Plus, X, Star, Trash2, Loader2, Check, ImagePlus
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PhotoCarousel } from "@/components/ui/photo-carousel";

interface Photo {
  id: string;
  url: string;
  position: number;
  is_cover: boolean;
}

interface CarGalleryProps {
  carId: string;
  /**
   * Preserved for backwards compatibility with the car detail page.
   * The carousel always fetches the full photo list from the API, so this is
   * used only as a hint — the live list takes precedence.
   */
  initialCoverUrl?: string | null;
}

type PendingFile = {
  file: File;
  previewUrl: string;
};

/**
 * Car photo gallery with:
 * - Swipeable carousel (momentum, dots, arrows)
 * - Drag & drop or tap to upload
 * - Preview confirm step (no forced crop — center-fit)
 * - Progress bar during upload
 * - Photo strip below carousel with tap-to-preview, set-cover, delete
 * - "Change cover" always available, even after a render is set
 */
export function CarGallery({ carId }: CarGalleryProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [changingCover, setChangingCover] = useState(false);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`/api/cars/${carId}/photos`);
    if (res.ok) {
      const json = await res.json();
      setPhotos(json.photos ?? []);
    }
    setLoading(false);
  }, [carId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  function stagePendingFile(file: File) {
    if (file.size > 8 * 1024 * 1024) { setError("Max 8MB per photo"); return; }
    if (!file.type.startsWith("image/")) { setError("Images only"); return; }
    setError(null);
    setPending({
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  async function confirmUpload() {
    if (!pending) return;
    setError(null);
    setUploading(true);
    setUploadProgress(0);

    // Use XMLHttpRequest so we can show upload progress.
    const fd = new FormData();
    fd.append("photo", pending.file);

    try {
      const result = await new Promise<{ ok: boolean; body: unknown }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/cars/${carId}/photos`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 95));
          }
        };
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText || "{}");
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, body });
          } catch (err) { reject(err); }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(fd);
      });

      setUploadProgress(100);
      if (!result.ok) {
        const err = result.body as { error?: string };
        throw new Error(err?.error ?? "Upload failed");
      }

      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
      await fetchPhotos();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  }

  function cancelPending() {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
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
      setChangingCover(false);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(photoId: string) {
    if (!confirm("Delete this photo? This cannot be undone.")) return;
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

  // Drag & drop handlers
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) stagePendingFile(file);
  }

  // Sort so cover is first — makes the carousel default to the cover photo.
  const orderedPhotos = [...photos].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return a.position - b.position;
  });

  const activePhoto = orderedPhotos[activeIndex] ?? null;

  if (loading) {
    return (
      <div>
        <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider mb-2">Photos</p>
        <div className="h-56 rounded-[14px] bg-[#1a1a1a] flex items-center justify-center">
          <Loader2 size={18} className="text-[rgba(255,255,255,0.2)] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider truncate">
          Photos {photos.length > 0 && <span className="text-[rgba(255,255,255,0.18)]">({photos.length})</span>}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => setChangingCover((v) => !v)}
              className="flex items-center gap-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] font-bold text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] transition-colors cursor-pointer"
            >
              <Star size={11} />
              Change cover
            </button>
          )}
          {photos.length > 0 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 min-h-[36px] px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-[#3B82F6] hover:text-[#60A5FA] transition-colors disabled:opacity-40 cursor-pointer"
            >
              {uploading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              Add photo
            </button>
          )}
        </div>
      </div>

      {/* Pending preview confirmation */}
      {pending ? (
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[#1a1a1a] overflow-hidden">
          <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pending.previewUrl}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>
          {uploading ? (
            <div className="p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-secondary)] mb-2">
                <Loader2 size={13} className="animate-spin text-[#3B82F6]" />
                Uploading… {uploadProgress}%
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                <div
                  className="h-full bg-[#3B82F6] transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="p-3 flex items-center gap-2">
              <button
                type="button"
                onClick={confirmUpload}
                className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] h-11 rounded-lg bg-[#3B82F6] text-white text-xs font-bold cursor-pointer hover:brightness-110"
              >
                <Check size={14} /> Looks good
              </button>
              <button
                type="button"
                onClick={cancelPending}
                className="flex items-center justify-center gap-1.5 min-h-[44px] h-11 px-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)] cursor-pointer hover:text-white"
              >
                Choose different
              </button>
            </div>
          )}
          {error && <p className="px-4 pb-3 text-[11px] text-[#f87171]">{error}</p>}
        </div>
      ) : photos.length === 0 ? (
        /* Empty state — large drop zone */
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-[14px] border-2 border-dashed cursor-pointer transition-all ${
            isDragging
              ? "border-[#3B82F6] bg-[rgba(59,130,246,0.08)]"
              : "border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] bg-[#1a1a1a]"
          }`}
          style={{ height: "200px" }}
        >
          <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
            <div className="w-12 h-12 rounded-full bg-[rgba(59,130,246,0.08)] flex items-center justify-center">
              <Camera size={20} className="text-[rgba(255,255,255,0.35)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-[rgba(255,255,255,0.5)]">
                {isDragging ? "Drop to upload" : "Drag & drop or tap to add a photo"}
              </p>
              <p className="text-[11px] text-[rgba(255,255,255,0.25)] mt-1">JPG, PNG, WebP · Max 8MB</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Carousel */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={isDragging ? "ring-2 ring-[#3B82F6] rounded-2xl" : ""}
          >
            <PhotoCarousel
              photos={orderedPhotos}
              aspectRatio="16/9"
              onIndexChange={setActiveIndex}
              onPhotoClick={(photo) => setLightbox(photo as Photo)}
              renderOverlay={(photo) => {
                const isCover = (photo as Photo).is_cover;
                return isCover ? (
                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 pointer-events-none">
                    <Star size={10} fill="#fbbf24" stroke="#fbbf24" />
                    <span className="text-[10px] font-bold text-[#fbbf24] uppercase tracking-wider">Cover</span>
                  </div>
                ) : null;
              }}
            />
          </div>

          {/* Photo strip */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 hide-scrollbar">
            {orderedPhotos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => {
                  if (changingCover) handleSetCover(photo.id);
                  else setActiveIndex(i);
                }}
                className={`relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all ${
                  activeIndex === i && !changingCover
                    ? "ring-2 ring-[#3B82F6]"
                    : "ring-1 ring-[rgba(255,255,255,0.08)] opacity-70 hover:opacity-100"
                } ${changingCover ? "hover:ring-2 hover:ring-[#fbbf24]" : ""}`}
                style={{ width: "72px", height: "54px" }}
                aria-label={photo.is_cover ? "Cover photo" : `Photo ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {photo.is_cover && (
                  <div className="absolute top-0.5 left-0.5">
                    <Star size={9} fill="#fbbf24" stroke="#fbbf24" />
                  </div>
                )}
                {changingCover && !photo.is_cover && (
                  <div className="absolute inset-0 bg-[#fbbf24]/10 flex items-center justify-center">
                    <Star size={14} className="text-[#fbbf24]" />
                  </div>
                )}
              </button>
            ))}

            {/* Upload tile */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-shrink-0 rounded-lg border-2 border-dashed border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.22)] bg-[#1a1a1a] flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
              style={{ width: "54px", height: "54px" }}
              aria-label="Add photo"
            >
              {uploading ? (
                <Loader2 size={14} className="text-[#3B82F6] animate-spin" />
              ) : (
                <ImagePlus size={14} className="text-[rgba(255,255,255,0.4)]" />
              )}
            </button>
          </div>

          {changingCover && (
            <p className="text-[10px] text-[#fbbf24] mt-2 flex items-center gap-1">
              <Star size={10} fill="currentColor" />
              Tap any photo above to make it the cover
            </p>
          )}

          {/* Action bar for current photo */}
          {activePhoto && !changingCover && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--color-text-muted)] truncate flex-1">
                {activePhoto.is_cover ? "Cover photo" : `Photo ${activeIndex + 1} of ${orderedPhotos.length}`}
              </p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {!activePhoto.is_cover && (
                  <button
                    type="button"
                    onClick={() => handleSetCover(activePhoto.id)}
                    disabled={actionLoading === activePhoto.id}
                    className="flex items-center gap-1 min-h-[36px] h-9 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] font-bold text-[#fbbf24] hover:border-[#fbbf24] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading === activePhoto.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Star size={11} fill="currentColor" />
                    )}
                    Set cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(activePhoto.id)}
                  disabled={actionLoading === activePhoto.id}
                  className="flex items-center gap-1 min-h-[36px] h-9 px-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] font-bold text-[#f87171] hover:border-[#f87171] transition-colors disabled:opacity-50 cursor-pointer"
                  aria-label="Delete photo"
                >
                  {actionLoading === activePhoto.id ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Trash2 size={11} />
                  )}
                  Delete
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && !pending && <p className="mt-1.5 text-[11px] text-[#f87171]">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) stagePendingFile(f);
          e.target.value = "";
        }}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} className="text-white" />
          </button>

          <div className="px-14 max-w-4xl w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt="Car photo"
              className="w-full rounded-[16px] object-contain"
              style={{ maxHeight: "75vh" }}
            />
            <div className="flex items-center justify-center gap-3 mt-5">
              {!lightbox.is_cover && (
                <button
                  type="button"
                  onClick={() => handleSetCover(lightbox.id)}
                  disabled={actionLoading === lightbox.id}
                  className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer"
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
              <button
                type="button"
                onClick={() => handleDelete(lightbox.id)}
                disabled={actionLoading === lightbox.id}
                className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer"
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
