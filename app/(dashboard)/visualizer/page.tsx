"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Sparkles, ImageIcon, Download, Upload, X, Eye,
  Wand2, Check, Star, Loader2, Camera
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select, Textarea } from "@/components/ui/input";
import { RenderLightbox } from "@/components/ui/render-lightbox";
import { haptic } from "@/lib/haptics";
import type { Car, Render, CarPhoto } from "@/lib/supabase/types";
import { formatRelativeDate } from "@/lib/utils";

/**
 * Lightweight markdown renderer for the streaming analyze response.
 * Supports: # / ## / ### headings, **bold**, *italic*, - bullets, paragraph breaks.
 */
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1.5 my-2">
        {listBuffer.map((item, i) => (
          <li key={i} className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  }

  function renderInline(s: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) {
        parts.push(
          <strong key={idx++} className="font-bold text-white">
            {tok.slice(2, -2)}
          </strong>
        );
      } else {
        parts.push(
          <em key={idx++} className="italic">
            {tok.slice(1, -1)}
          </em>
        );
      }
      last = m.index + tok.length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (line.startsWith("### ")) {
      flushList();
      blocks.push(
        <h4 key={`h-${i}`} className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mt-4 mb-1.5">
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <h3 key={`h-${i}`} className="text-sm font-black mt-5 mb-2 text-white">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      flushList();
      blocks.push(
        <h2 key={`h-${i}`} className="text-base font-black mt-5 mb-2 text-white">
          {line.slice(2)}
        </h2>
      );
    } else if (/^[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*]\s+/, ""));
    } else if (line === "") {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={`p-${i}`} className="text-xs leading-relaxed text-[var(--color-text-secondary)] mb-2">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();
  return blocks;
}

/**
 * Scene presets — each pre-fills the prompt with a full scene description.
 * The API already leads DALL-E with the exact car details, so the user just
 * needs a scene + optional color/wheel tweaks.
 */
interface ScenePreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  buildPrompt: () => string;
}

const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "track",
    label: "Track Day",
    icon: "🏁",
    description: "Apex of a racing circuit corner",
    buildPrompt: () =>
      "On a racing circuit at the apex of a corner, red-and-white curbs visible under the wheels, tire smoke curling from the rear, aggressive low 3/4 angle from the outside of the turn, track atmosphere, cinematic motorsport photography, overcast dramatic lighting.",
  },
  {
    id: "drag",
    label: "Drag Strip",
    icon: "🛣️",
    description: "Christmas tree lights, launching",
    buildPrompt: () =>
      "Launching from the starting line of a drag strip, front wheels lifting slightly, burnout smoke billowing from the rear tires, Christmas tree lights glowing in the foreground, head-on low perspective, NHRA motorsport photography, sharp focus, golden hour.",
  },
  {
    id: "city-night",
    label: "Neon Night",
    icon: "🌆",
    description: "Wet streets, neon reflections",
    buildPrompt: () =>
      "Parked on a wet urban street at night, neon signs and skyscraper lights reflecting off the wet asphalt and paint, moody cyberpunk Tokyo/LA atmosphere, shallow depth of field, cinematic nightlife vibe, 3/4 front angle.",
  },
  {
    id: "canyon",
    label: "Canyon Run",
    icon: "🏔️",
    description: "Mountain switchback, golden hour",
    buildPrompt: () =>
      "Carving through a switchback on a mountain canyon road at golden hour, warm sunlight raking across the bodywork, valley vistas in the background, dramatic long lens compression, automotive editorial photography.",
  },
  {
    id: "car-meet",
    label: "Car Meet",
    icon: "🚗",
    description: "Underground parking garage meet",
    buildPrompt: () =>
      "Centered in a dim underground parking garage at night, surrounded by blurred enthusiast cars and soft fluorescent lighting, pop-up car-meet atmosphere, shallow depth of field isolating the subject, editorial automotive photography, cinematic film grain.",
  },
  {
    id: "studio",
    label: "Studio",
    icon: "📸",
    description: "Clean studio hero shot",
    buildPrompt: () =>
      "Professional automotive studio shoot on a seamless dark grey backdrop with soft overhead rim lighting, perfect reflections on the paint, magazine cover quality, razor-sharp focus, 3/4 front hero angle.",
  },
  {
    id: "snow",
    label: "Snow Run",
    icon: "❄️",
    description: "Fresh snow, alpine forest",
    buildPrompt: () =>
      "Kicking up fresh powder on a snow-covered alpine forest road, snowflakes in mid-air around the car, dramatic pine tree backdrop, crisp cold winter light, long exposure motion blur on the ground, cinematic rally photography.",
  },
  {
    id: "desert",
    label: "Desert Dune",
    icon: "🏜️",
    description: "Golden sand, sunset glow",
    buildPrompt: () =>
      "Parked on a cracked salt flat / desert dune at sunset, long shadows stretching across the sand, warm golden sky with cloud bands, heat shimmer in the distance, cinematic automotive editorial photography, wide angle.",
  },
];

interface DetailPreset {
  id: "color" | "wheels";
  label: string;
  icon: string;
  description: string;
}

const DETAIL_PRESETS: DetailPreset[] = [
  { id: "color", label: "Color Change", icon: "🎨", description: "Respray in a new color" },
  { id: "wheels", label: "New Wheels", icon: "🔧", description: "Try a different wheel style" },
];

const WHEEL_STYLES = [
  { value: "deep-dish", label: "Deep Dish" },
  { value: "mesh", label: "Multi-spoke Mesh" },
  { value: "spoke", label: "5-spoke Forged" },
  { value: "split", label: "Split 5" },
  { value: "concave", label: "Concave" },
];

function VisualizerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedCarId = searchParams.get("carId");

  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState(preselectedCarId ?? "");
  const [carPhotos, setCarPhotos] = useState<CarPhoto[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<Render[]>([]);
  const [loadingRenders, setLoadingRenders] = useState(true);
  const [latestRender, setLatestRender] = useState<Render | null>(null);
  const [settingCover, setSettingCover] = useState(false);
  const [coverSet, setCoverSet] = useState(false);

  // Color / wheels popover
  const [detailPopover, setDetailPopover] = useState<null | "color" | "wheels">(null);
  const [colorInput, setColorInput] = useState("");
  const [wheelStyle, setWheelStyle] = useState<string>("deep-dish");

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedMediaType, setUploadedMediaType] = useState<"image/jpeg" | "image/png" | "image/webp" | "image/gif">("image/jpeg");
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"render" | "analyze">("render");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedRender, setExpandedRender] = useState<Render | null>(null);

  const selectedCar = cars.find((c) => c.id === selectedCarId) ?? null;
  const carLabel = selectedCar ? `${selectedCar.year} ${selectedCar.make} ${selectedCar.model}` : "your car";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const { data } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const carList = (data ?? []) as Car[];
      setCars(carList);
      if (!selectedCarId && carList[0]) setSelectedCarId(carList[0].id);

      const carIds = carList.map((c) => c.id);
      if (carIds.length) {
        const { data: renderData } = await supabase
          .from("renders")
          .select("*")
          .in("car_id", carIds)
          .order("created_at", { ascending: false })
          .limit(20);
        const list = (renderData ?? []) as Render[];
        setRenders(list);
        if (list[0]) setLatestRender(list[0]);
      }
      setLoadingRenders(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load photos whenever selected car changes — these are shown as thumbnails
  // so the user knows which photos are being used as reference for DALL-E.
  useEffect(() => {
    if (!selectedCarId) { setCarPhotos([]); return; }
    const supabase = createClient();
    supabase
      .from("car_photos")
      .select("*")
      .eq("car_id", selectedCarId)
      .order("is_cover", { ascending: false })
      .order("position", { ascending: true })
      .limit(6)
      .then(({ data }) => {
        setCarPhotos((data ?? []) as CarPhoto[]);
      });
  }, [selectedCarId]);

  function applyScenePreset(preset: ScenePreset) {
    setPrompt(preset.buildPrompt());
    haptic("light");
  }

  function applyColorChange() {
    if (!colorInput.trim()) return;
    setPrompt(
      `Respray the car in ${colorInput.trim()} — keep every other detail identical (wheels, stance, kit). Clean studio/showroom setting, glossy professional finish, 3/4 front hero angle.`
    );
    setDetailPopover(null);
    setColorInput("");
    haptic("light");
  }

  function applyWheelChange() {
    const style = WHEEL_STYLES.find((w) => w.value === wheelStyle)?.label ?? "deep dish";
    setPrompt(
      `Swap the wheels to aftermarket ${style} wheels, staggered fitment, aggressive offset that fills the arches perfectly. Keep the paint, body kit, and stance. Clean 3/4 front angle, natural daylight, photorealistic.`
    );
    setDetailPopover(null);
    haptic("light");
  }

  async function handleGenerate() {
    if (!selectedCarId || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    haptic("light");

    try {
      const res = await fetch("/api/ai/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: selectedCarId, prompt: prompt.trim() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");

      const newRender = json.render as Render;
      setRenders((prev) => [newRender, ...prev]);
      setLatestRender(newRender);
      setCoverSet(false);
      haptic("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Feature 18 — Imagine: fan out to N diverse interpretations in one shot.
  async function handleImagine() {
    if (!selectedCarId || !prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    haptic("medium");

    try {
      const res = await fetch("/api/ai/imagine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: selectedCarId,
          prompt: prompt.trim(),
          count: 4,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Imagine failed");

      const newRenders = (json.renders ?? []) as Render[];
      if (newRenders.length === 0) {
        throw new Error("No renders returned");
      }
      setRenders((prev) => [...newRenders, ...prev]);
      setLatestRender(newRenders[0]);
      setCoverSet(false);
      haptic("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Imagine failed");
    } finally {
      setLoading(false);
    }
  }

  async function setAsCover(render: Render) {
    if (!render.image_url || !selectedCarId) return;
    setSettingCover(true);
    haptic("medium");
    try {
      const res = await fetch(`/api/cars/${selectedCarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_image_url: render.image_url }),
      });
      if (!res.ok) throw new Error("Failed to set cover");
      setCoverSet(true);
      haptic("success");
      router.refresh();
      setTimeout(() => setCoverSet(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set cover");
    } finally {
      setSettingCover(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const [header, base64] = result.split(",");
      const detected = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      const safe: "image/jpeg" | "image/png" | "image/webp" | "image/gif" =
        detected === "image/png" ? "image/png" :
        detected === "image/webp" ? "image/webp" :
        detected === "image/gif" ? "image/gif" : "image/jpeg";
      setUploadedImage(base64);
      setUploadedMediaType(safe);
      setUploadedPreview(result);
      setAnalysisText("");
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!uploadedImage) return;
    setAnalyzing(true);
    setError(null);
    setAnalysisText("");
    haptic("light");

    try {
      const res = await fetch("/api/ai/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: uploadedImage,
          media_type: uploadedMediaType,
          car_id: selectedCarId || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Analysis failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnalysisText(acc);
      }
      haptic("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleDownload(render: Render) {
    if (!render.image_url) return;
    const a = document.createElement("a");
    a.href = render.image_url;
    a.download = `modvault-render-${render.id.slice(0, 8)}.jpg`;
    a.click();
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center">
          <Wand2 size={18} className="text-[#60A5FA]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">Visualizer</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">Describe a scene. See it rendered on your car.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-[var(--color-bg-card)] rounded-2xl p-1.5 my-6 gap-1 border border-[var(--color-border)] max-w-md">
        <button
          onClick={() => setActiveTab("render")}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] h-11 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "render"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          <Sparkles size={14} />
          Generate Render
        </button>
        <button
          onClick={() => setActiveTab("analyze")}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] h-11 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "analyze"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          <Eye size={14} />
          Analyze Photo
        </button>
      </div>

      {/* Render tab */}
      {activeTab === "render" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT: Form */}
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 sm:p-6 space-y-5">
              {cars.length > 0 && (
                <Select
                  label="Vehicle"
                  value={selectedCarId}
                  onChange={(e) => setSelectedCarId(e.target.value)}
                  options={cars.map((c) => ({
                    value: c.id,
                    label: `${c.year} ${c.make} ${c.model}${c.nickname ? ` (${c.nickname})` : ""}`,
                  }))}
                />
              )}

              {/* Reference photos — so the user knows the AI sees their car */}
              {selectedCar && (
                <div className="rounded-2xl bg-[var(--color-accent-muted)] border border-[rgba(59,130,246,0.25)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={12} className="text-[#60A5FA]" />
                    <p className="text-[10px] font-bold text-[#60A5FA] uppercase tracking-wider">
                      Using your {carLabel} as reference
                    </p>
                  </div>
                  {carPhotos.length > 0 ? (
                    <>
                      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                        {carPhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-[rgba(255,255,255,0.12)]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.url}
                              alt="Reference"
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {photo.is_cover && (
                              <div className="absolute top-0.5 left-0.5">
                                <Star size={9} fill="#fbbf24" stroke="#fbbf24" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-2.5 leading-relaxed">
                        AI will match your car&apos;s color, wheels and stance to these photos.
                      </p>
                    </>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <Camera size={13} className="text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                        No photos uploaded yet. AI will use your car&apos;s year/make/model/color from the garage. Upload real photos in the car detail page for more accurate renders.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Scene presets — one tap fills the prompt with full scene, no retyping */}
              <div>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Quick scenes
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SCENE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyScenePreset(preset)}
                      className="px-2 py-3 rounded-xl border bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-white hover:bg-[var(--color-accent-muted)] text-center transition-all cursor-pointer min-h-[68px]"
                      title={preset.description}
                    >
                      <div className="text-base mb-0.5">{preset.icon}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider leading-tight">{preset.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail tweaks — color change, wheels */}
              <div>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Detail tweaks
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DETAIL_PRESETS.map((preset) => (
                    <div key={preset.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setDetailPopover(detailPopover === preset.id ? null : preset.id)}
                        className={`w-full px-3 py-3 rounded-xl border text-center transition-all cursor-pointer min-h-[68px] ${
                          detailPopover === preset.id
                            ? "bg-[var(--color-accent-muted)] border-[var(--color-accent)] text-white"
                            : "bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-white"
                        }`}
                        title={preset.description}
                      >
                        <div className="text-base mb-0.5">{preset.icon}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider">{preset.label}</div>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Color popover */}
                {detailPopover === "color" && (
                  <div className="mt-2 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-accent)] p-4">
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      What color?
                    </p>
                    <input
                      type="text"
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      placeholder="e.g. Nardo grey, matte black, pearl white"
                      className="w-full h-11 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 text-sm text-white placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
                      onKeyDown={(e) => e.key === "Enter" && applyColorChange()}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={applyColorChange}
                      disabled={!colorInput.trim()}
                      className="mt-2 w-full h-11 rounded-lg bg-[var(--color-accent)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Apply color
                    </button>
                  </div>
                )}

                {/* Wheels popover */}
                {detailPopover === "wheels" && (
                  <div className="mt-2 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-accent)] p-4">
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Wheel style
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {WHEEL_STYLES.map((w) => (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => setWheelStyle(w.value)}
                          className={`h-11 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            wheelStyle === w.value
                              ? "bg-[var(--color-accent)] text-white"
                              : "bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={applyWheelChange}
                      className="mt-2 w-full h-11 rounded-lg bg-[var(--color-accent)] text-white text-xs font-bold cursor-pointer"
                    >
                      Apply wheels
                    </button>
                  </div>
                )}
              </div>

              <Textarea
                label="Prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to see, or tap a scene button above."
                rows={5}
                hint="Your car's year/make/model/color and installed mods are always sent with the prompt — you don't need to repeat them."
              />

              {error && (
                <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.15)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
                <button
                  onClick={handleGenerate}
                  disabled={!selectedCarId || !prompt.trim() || loading}
                  className="rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-[0_8px_32px_rgba(59,130,246,0.3)]"
                  style={{ minHeight: "52px" }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Generate Render
                    </>
                  )}
                </button>
                <button
                  onClick={handleImagine}
                  disabled={!selectedCarId || !prompt.trim() || loading}
                  className="rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-bright)] text-white text-sm font-bold flex items-center justify-center gap-2 px-5 hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-accent)] transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  style={{ minHeight: "52px" }}
                  title="Generate 4 diverse interpretations at once"
                >
                  <Wand2 size={16} className="text-[var(--color-accent-bright)]" />
                  Imagine ×4
                </button>
              </div>
              {loading && (
                <p className="text-[11px] text-center text-[var(--color-text-muted)]">
                  DALL-E 3 rendering — single takes ~20s, Imagine ×4 takes ~45s
                </p>
              )}
            </div>

            {/* RIGHT: Preview */}
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4 gap-2">
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider truncate">
                  {loading ? "Rendering..." : latestRender ? "Latest Render" : "Preview"}
                </p>
                {latestRender?.image_url && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(latestRender)}
                      className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-border-bright)] cursor-pointer"
                      aria-label="Download"
                    >
                      <Download size={14} className="text-[var(--color-text-secondary)]" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 flex items-center justify-center min-h-[280px]">
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-[var(--color-text-muted)]">Building your render...</p>
                  </div>
                ) : latestRender?.image_url ? (
                  <div className="w-full">
                    <button
                      onClick={() => setExpandedRender(latestRender)}
                      className="block w-full rounded-2xl overflow-hidden border border-[var(--color-border)] cursor-pointer group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={latestRender.image_url}
                        alt={latestRender.user_prompt}
                        className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </button>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-3 line-clamp-2 break-words">{latestRender.user_prompt}</p>
                    <button
                      onClick={() => setAsCover(latestRender)}
                      disabled={settingCover || coverSet}
                      className="w-full mt-3 min-h-[44px] h-11 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-bold flex items-center justify-center gap-2 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {settingCover ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : coverSet ? (
                        <>
                          <Check size={13} className="text-[var(--color-success)]" /> Cover updated
                        </>
                      ) : (
                        <>
                          <Star size={13} /> Set as car cover photo
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <ImageIcon size={32} className="mx-auto text-[var(--color-text-disabled)] mb-3" />
                    <p className="text-sm font-bold text-[var(--color-text-secondary)]">No render yet</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5">Tap a scene to begin</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Render Gallery (masonry) */}
          <div>
            <h2 className="text-base font-bold tracking-tight mb-4">Render Gallery</h2>
            {loadingRenders ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-video skeleton rounded-2xl" />
                ))}
              </div>
            ) : renders.length === 0 ? (
              <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] py-16 text-center">
                <ImageIcon size={22} className="mx-auto text-[var(--color-text-disabled)] mb-3" />
                <p className="text-sm font-bold text-[var(--color-text-secondary)]">No renders yet</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5">Describe a mod above</p>
              </div>
            ) : (
              <div className="masonry-grid">
                {renders.map((render) => (
                  <div
                    key={render.id}
                    className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden card-hover cursor-pointer group"
                    onClick={() => setExpandedRender(render)}
                  >
                    {render.image_url ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={render.image_url}
                          alt={`AI render: ${render.user_prompt}`}
                          className="w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          style={{ aspectRatio: "4/3" }}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-bold">
                            <Eye size={13} /> View Full Size
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[var(--color-bg-elevated)] flex items-center justify-center" style={{ aspectRatio: "4/3" }}>
                        <p className="text-xs text-[var(--color-text-muted)]">No image</p>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-2 break-words">{render.user_prompt}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{formatRelativeDate(render.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analyze tab */}
      {activeTab === "analyze" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
            {cars.length > 0 && (
              <div className="mb-5">
                <Select
                  label="Vehicle context (optional)"
                  value={selectedCarId}
                  onChange={(e) => setSelectedCarId(e.target.value)}
                  options={[
                    { value: "", label: "Let AI identify the car" },
                    ...cars.map((c) => ({
                      value: c.id,
                      label: `${c.year} ${c.make} ${c.model}${c.nickname ? ` (${c.nickname})` : ""}`,
                    })),
                  ]}
                />
                <p className="mt-2 text-[10px] text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Sparkles size={10} className="text-[var(--color-accent-bright)]" />
                  Your full garage (cars + mods) is sent automatically — no need to explain it.
                </p>
              </div>
            )}

            {!uploadedPreview ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[var(--color-border)] rounded-2xl p-12 flex flex-col items-center gap-4 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center group-hover:bg-[rgba(59,130,246,0.1)] transition-colors">
                  <Upload size={24} className="text-[var(--color-text-muted)] group-hover:text-[#60A5FA] transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold">Upload a car photo</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">JPG, PNG or WebP · Max 8MB</p>
                </div>
              </button>
            ) : (
              <div className="relative rounded-2xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedPreview} alt="Uploaded car" className="w-full max-h-80 object-cover" />
                <button
                  onClick={() => {
                    setUploadedPreview(null);
                    setUploadedImage(null);
                    setAnalysisText("");
                  }}
                  className="absolute top-3 right-3 min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors cursor-pointer"
                >
                  <X size={15} className="text-white" />
                </button>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileUpload} />

            {error && (
              <div className="mt-4 rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.15)] px-4 py-3 text-xs text-[var(--color-danger)]">
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!uploadedImage || analyzing}
              className="w-full mt-5 min-h-[48px] h-12 rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              {analyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Eye size={16} /> Analyze Photo
                </>
              )}
            </button>
          </div>

          {(analyzing || analysisText) && (
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden animate-in lg:max-h-[80vh] lg:overflow-y-auto">
              <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between sticky top-0 bg-[var(--color-bg-card)] z-10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-accent-muted)] flex items-center justify-center">
                    <Eye size={13} className="text-[var(--color-accent-bright)]" />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    AI Analysis
                  </p>
                </div>
                {analyzing && (
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent-bright)] font-bold">
                    <Loader2 size={11} className="animate-spin" />
                    Streaming…
                  </div>
                )}
              </div>
              <div className="px-6 py-5">
                {analysisText ? (
                  <div className="prose prose-invert max-w-none">{renderMarkdown(analysisText)}</div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Loader2 size={13} className="animate-spin" />
                    Looking at your photo with the rest of your garage in mind…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reusable fullscreen render lightbox with zoom + pan */}
      {expandedRender && expandedRender.image_url && (
        <RenderLightbox
          src={expandedRender.image_url}
          alt={expandedRender.user_prompt}
          open={!!expandedRender}
          onClose={() => setExpandedRender(null)}
          caption={expandedRender.user_prompt}
          actions={
            <>
              <button
                type="button"
                onClick={() => setAsCover(expandedRender)}
                className="flex items-center gap-2 min-h-[44px] h-11 px-4 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-xs font-bold text-white hover:bg-black/80 transition-colors cursor-pointer"
              >
                <Star size={13} /> Set as Cover
              </button>
              <button
                type="button"
                onClick={() => handleDownload(expandedRender)}
                className="flex items-center gap-2 min-h-[44px] h-11 px-4 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-xs font-bold text-white hover:bg-black/80 transition-colors cursor-pointer"
              >
                <Download size={13} /> Download
              </button>
            </>
          }
        />
      )}

      <div className="h-8" />
    </div>
  );
}

export default function VisualizerPage() {
  return (
    <Suspense>
      <VisualizerContent />
    </Suspense>
  );
}
