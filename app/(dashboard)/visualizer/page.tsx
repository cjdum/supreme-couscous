"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Sparkles, ImageIcon, Download, Upload, X, Eye,
  ShoppingCart, ExternalLink, Wand2, Camera, Check, Star, Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select, Textarea } from "@/components/ui/input";
import { CategoryBadge } from "@/components/ui/badge";
import { haptic } from "@/lib/haptics";
import type { Car, Render, ModCategory } from "@/lib/supabase/types";
import { formatRelativeDate } from "@/lib/utils";

interface ImageAnalysis {
  detected_vehicle: string;
  visible_mods: string[];
  stock_parts: string[];
  condition: string;
  color: string;
  stance: string;
  body_style: string;
  overall_assessment: string;
  suggestions: {
    name: string;
    category: ModCategory;
    reason: string;
    estimated_cost: string;
    priority: string;
    amazon_url: string;
    summit_url: string;
  }[];
}

interface StylePreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  modifier: string;
}

const STYLE_PRESETS: StylePreset[] = [
  { id: "studio", label: "Studio Shot", emoji: "🎨", description: "Clean white background", modifier: "Studio photography on a seamless white backdrop, perfect lighting, sharp focus, magazine quality" },
  { id: "action", label: "Action Shot", emoji: "💨", description: "Motion blur, dynamic", modifier: "Dynamic action shot, mid-corner with motion blur on background, dramatic angle" },
  { id: "track", label: "Track Day", emoji: "🏁", description: "On the circuit", modifier: "On a race track at apex, kerbs visible, racing environment, cinematic" },
  { id: "show", label: "Show Car", emoji: "🏆", description: "Concours display", modifier: "Concours show display, polished perfection, dramatic spotlights, automotive showcase event" },
  { id: "night", label: "Night Scene", emoji: "🌃", description: "Tokyo nights vibe", modifier: "Nighttime urban environment, neon city lights reflecting on paint, atmospheric, JDM photography" },
];

function VisualizerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedCarId = searchParams.get("carId");

  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState(preselectedCarId ?? "");
  const [prompt, setPrompt] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<Render[]>([]);
  const [loadingRenders, setLoadingRenders] = useState(true);
  const [latestRender, setLatestRender] = useState<Render | null>(null);
  const [settingCover, setSettingCover] = useState(false);
  const [coverSet, setCoverSet] = useState(false);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedMediaType, setUploadedMediaType] = useState<string>("image/jpeg");
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<"render" | "analyze">("render");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedRender, setExpandedRender] = useState<Render | null>(null);

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

  async function handleGenerate() {
    if (!selectedCarId || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    haptic("light");

    const fullPrompt = activePreset
      ? `${prompt.trim()}. ${STYLE_PRESETS.find((p) => p.id === activePreset)?.modifier}`
      : prompt.trim();

    try {
      const res = await fetch("/api/ai/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: selectedCarId, prompt: fullPrompt }),
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
      const mediaType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      setUploadedImage(base64);
      setUploadedMediaType(mediaType);
      setUploadedPreview(result);
      setAnalysis(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!uploadedImage) return;
    setAnalyzing(true);
    setError(null);

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

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      setAnalysis(json.analysis as ImageAnalysis);
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
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Visualizer</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Describe a mod. See it rendered on your car.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-[var(--color-bg-card)] rounded-2xl p-1.5 my-6 gap-1 border border-[var(--color-border)] max-w-md">
        <button
          onClick={() => setActiveTab("render")}
          className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
          className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "analyze"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          <Eye size={14} />
          Analyze Photo
        </button>
      </div>

      {/* Render tab — side by side on desktop */}
      {activeTab === "render" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT: Form */}
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 space-y-5">
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

              <div>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Style Preset</p>
                <div className="grid grid-cols-5 gap-2">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setActivePreset(activePreset === preset.id ? null : preset.id)}
                      className={`px-2 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        activePreset === preset.id
                          ? "bg-[var(--color-accent-muted)] border-[var(--color-accent)] text-white"
                          : "bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-bright)] hover:text-white"
                      }`}
                      title={preset.description}
                    >
                      <div className="text-base mb-0.5">{preset.emoji}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider leading-tight">{preset.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                label="Describe your desired look"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Wide body kit, Vossen wheels, matte chalk wrap, lowered on KW coilovers, carbon fiber splitter and rear wing..."
                rows={5}
                hint="Be specific. Brand names work great."
              />

              {error && (
                <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.15)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!selectedCarId || !prompt.trim() || loading}
                className="w-full h-13 rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-[0_8px_32px_rgba(59,130,246,0.3)]"
                style={{ height: "52px" }}
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
              {loading && (
                <p className="text-[11px] text-center text-[var(--color-text-muted)]">
                  DALL-E 3 rendering — usually 15-30 seconds
                </p>
              )}
            </div>

            {/* RIGHT: Preview */}
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {loading ? "Rendering..." : latestRender ? "Latest Render" : "Preview"}
                </p>
                {latestRender?.image_url && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDownload(latestRender)}
                      className="w-8 h-8 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-border-bright)] cursor-pointer"
                      aria-label="Download"
                    >
                      <Download size={13} className="text-[var(--color-text-secondary)]" />
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
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-3 line-clamp-2">{latestRender.user_prompt}</p>
                    <button
                      onClick={() => setAsCover(latestRender)}
                      disabled={settingCover || coverSet}
                      className="w-full mt-3 h-10 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-bold flex items-center justify-center gap-2 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors disabled:opacity-50 cursor-pointer"
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
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5">Describe your build to begin</p>
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
                        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">{render.user_prompt}</p>
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
                    setAnalysis(null);
                  }}
                  className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors cursor-pointer"
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
              className="w-full mt-5 h-12 rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
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

          {analysis && (
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden animate-in lg:max-h-[70vh] lg:overflow-y-auto">
              <div className="px-6 py-5 border-b border-[var(--color-border)]">
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Detected Vehicle</p>
                <h3 className="text-lg font-black">{analysis.detected_vehicle}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">{analysis.overall_assessment}</p>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[var(--color-border)] border-b border-[var(--color-border)]">
                {[
                  { label: "Color", value: analysis.color },
                  { label: "Condition", value: analysis.condition },
                  { label: "Stance", value: analysis.stance },
                ].map((item) => (
                  <div key={item.label} className="px-4 py-4 text-center">
                    <p className="text-[10px] text-[var(--color-text-muted)] mb-1 font-bold uppercase tracking-wider">{item.label}</p>
                    <p className="text-xs font-bold capitalize">{item.value || "—"}</p>
                  </div>
                ))}
              </div>

              {analysis.visible_mods?.length > 0 && (
                <div className="px-6 py-4 border-b border-[var(--color-border)]">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Visible Mods</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.visible_mods.map((mod, i) => (
                      <span key={i} className="tag bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.suggestions?.length > 0 && (
                <div className="px-6 py-5">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">AI Suggestions</p>
                  <div className="space-y-3">
                    {analysis.suggestions.map((s, i) => (
                      <div key={i} className="rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-bold">{s.name}</p>
                          <span
                            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider"
                            style={{
                              background:
                                s.priority === "high"
                                  ? "rgba(255,69,58,0.1)"
                                  : s.priority === "medium"
                                  ? "rgba(255,159,10,0.1)"
                                  : "rgba(255,255,255,0.05)",
                              color:
                                s.priority === "high"
                                  ? "#ff453a"
                                  : s.priority === "medium"
                                  ? "#ff9f0a"
                                  : "#555",
                            }}
                          >
                            {s.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <CategoryBadge category={s.category} className="text-[10px]" />
                          <span className="text-[10px] text-[var(--color-text-muted)] font-bold">{s.estimated_cost}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">{s.reason}</p>
                        <div className="flex gap-2 flex-wrap">
                          {s.amazon_url && (
                            <a
                              href={s.amazon_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(255,153,0,0.08)] border border-[rgba(255,153,0,0.15)] text-[10px] font-bold text-[#FF9900] hover:bg-[rgba(255,153,0,0.15)] transition-colors"
                            >
                              <ShoppingCart size={10} /> Amazon <ExternalLink size={8} />
                            </a>
                          )}
                          {s.summit_url && (
                            <a
                              href={s.summit_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[10px] font-bold text-[var(--color-text-muted)] hover:border-[var(--color-border-bright)] transition-colors"
                            >
                              Summit <ExternalLink size={8} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {expandedRender && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-5"
          onClick={() => setExpandedRender(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedRender(null)}
              className="absolute -top-12 right-0 w-10 h-10 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
            >
              <X size={16} className="text-white" />
            </button>
            {expandedRender.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={expandedRender.image_url} alt={expandedRender.user_prompt} className="w-full rounded-3xl" />
            )}
            <div className="mt-4 flex items-start justify-between gap-4">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed flex-1">{expandedRender.user_prompt}</p>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setAsCover(expandedRender)}
                  className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] transition-all cursor-pointer"
                >
                  <Star size={13} /> Set as Cover
                </button>
                {expandedRender.image_url && (
                  <button
                    onClick={() => handleDownload(expandedRender)}
                    className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] transition-all cursor-pointer"
                  >
                    <Download size={13} /> Download
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
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
