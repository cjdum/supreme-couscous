"use client";

import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface CarPhotoManagerProps {
  carId: string;
  currentPhotoUrl: string | null;
}

export function CarPhotoManager({ carId, currentPhotoUrl }: CarPhotoManagerProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("Max 5MB per photo");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Images only");
      return;
    }

    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    const fd = new FormData();
    fd.append("photo", file);

    try {
      const res = await fetch(`/api/cars/${carId}/photo`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setPreview(json.url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(currentPhotoUrl);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${carId}/photo`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider mb-2">Cover Photo</p>

      <div
        onClick={() => !preview && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={`relative rounded-[14px] overflow-hidden border-2 border-dashed transition-all ${
          isDragging
            ? "border-[#3B82F6] bg-[rgba(59,130,246,0.08)]"
            : preview
            ? "border-[rgba(255,255,255,0.07)]"
            : "border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] bg-[#1a1a1a] cursor-pointer"
        }`}
        style={{ height: "160px" }}
      >
        {uploading || removing ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={22} className="text-[#3B82F6] animate-spin" />
          </div>
        ) : preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-black text-xs font-semibold cursor-pointer"
              >
                <Upload size={11} /> Change
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 border border-white/20 text-white text-xs font-semibold cursor-pointer"
              >
                <X size={11} /> Remove
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 select-none">
            <Camera size={22} className="text-[rgba(255,255,255,0.2)]" />
            <div className="text-center">
              <p className="text-xs font-medium text-[rgba(255,255,255,0.4)]">Tap to add photo</p>
              <p className="text-[10px] text-[rgba(255,255,255,0.2)] mt-0.5">JPG, PNG, WebP · Max 5MB</p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {error && (
        <p className="mt-1.5 text-[11px] text-[#f87171]">{error}</p>
      )}
    </div>
  );
}
