"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, ImageIcon, Download, Upload, X, Eye, ShoppingCart, ExternalLink, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { CategoryBadge } from "@/components/ui/badge";
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

function VisualizerContent() {
  const searchParams = useSearchParams();
  const preselectedCarId = searchParams.get("carId");

  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState(preselectedCarId ?? "");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<Render[]>([]);
  const [loadingRenders, setLoadingRenders] = useState(true);

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
        setRenders((renderData ?? []) as Render[]);
      }
      setLoadingRenders(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    if (!selectedCarId || !prompt.trim()) return;
    setLoading(true);
    setError(null);

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
      setPrompt("");
      setExpandedRender(newRender);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
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

  const selectedCar = cars.find((c) => c.id === selectedCarId);

  const promptSuggestions = selectedCar
    ? [
        `Wide body kit, deep-dish wheels, slammed on coilovers, matte black wrap`,
        `Full track build — roll cage, racing livery, aero splitter and wing`,
        `Clean JDM build — lowered, bronze wheels, tinted windows`,
        `Carbon fiber aero, Vossen wheels, pearl white wrap`,
      ]
    : [];

  return (
    <div className="px-5 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center">
          <Wand2 size={17} className="text-[#60A5FA]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Visualizer</h1>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 pl-[52px]">
        Describe a mod. See it rendered on your car.
      </p>

      {/* Tab switcher */}
      <div className="flex bg-[var(--color-bg-card)] rounded-2xl p-1.5 mb-6 gap-1 border border-[var(--color-border)]">
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

      {/* Render tab */}
      {activeTab === "render" && (
        <div className="space-y-5 mb-6">
          <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-6">
            {cars.length > 0 && (
              <div className="mb-5">
                <Select
                  label="Vehicle"
                  value={selectedCarId}
                  onChange={(e) => setSelectedCarId(e.target.value)}
                  options={cars.map((c) => ({
                    value: c.id,
                    label: `${c.year} ${c.make} ${c.model}${c.nickname ? ` (${c.nickname})` : ""}`,
                  }))}
                />
              </div>
            )}

            <Textarea
              label="Describe your desired look"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Wide body kit, Vossen wheels, matte chalk wrap, lowered on KW coilovers, carbon fiber splitter and rear wing..."
              rows={4}
              hint="The more specific you are, the better the result"
            />

            {/* Quick suggestions */}
            {promptSuggestions.length > 0 && !prompt && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5">Quick styles</p>
                <div className="flex flex-wrap gap-2">
                  {promptSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrompt(s)}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[rgba(59,130,246,0.3)] hover:text-[var(--color-text-secondary)] transition-all cursor-pointer"
                    >
                      {s.split(",")[0].trim()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.15)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
                {error}
              </div>
            )}

            {/* Large prominent generate button */}
            <Button className="w-full mt-5 h-12 text-sm font-bold" onClick={handleGenerate} loading={loading} disabled={!selectedCarId || !prompt.trim()}>
              <Sparkles size={16} />
              {loading ? "Generating with DALL-E 3..." : "Generate Render"}
            </Button>

            {loading && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[11px] text-center text-[var(--color-text-muted)]">
                  DALL-E 3 is rendering your build — usually 15-30 seconds
                </p>
              </div>
            )}
          </div>

          {/* Render Gallery — masonry style */}
          <div>
            <h2 className="text-sm font-bold mb-4">Render Gallery</h2>
            {loadingRenders ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="aspect-video skeleton rounded-2xl" />)}
              </div>
            ) : renders.length === 0 ? (
              <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-4">
                  <ImageIcon size={22} className="text-[var(--color-text-disabled)]" />
                </div>
                <p className="text-base font-bold text-[var(--color-text-secondary)]">No renders yet</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5 max-w-xs mx-auto">
                  Describe a mod. See it rendered on your car.
                </p>
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
                          className="w-full object-cover"
                          style={{ aspectRatio: "4/3" }}
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-xs font-semibold">
                            <Eye size={13} /> View Full Size
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[var(--color-bg-elevated)] flex items-center justify-center" style={{ aspectRatio: "4/3" }}>
                        <p className="text-xs text-[var(--color-text-muted)]">No image</p>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 p-3.5">
                      <div className="min-w-0">
                        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">{render.user_prompt}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{formatRelativeDate(render.created_at)}</p>
                      </div>
                      {render.image_url && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(render); }}
                          className="shrink-0 p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
                          aria-label="Download"
                        >
                          <Download size={14} />
                        </button>
                      )}
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
        <div className="space-y-5 mb-6">
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
                className="w-full border-2 border-dashed border-[var(--color-border)] rounded-2xl p-10 flex flex-col items-center gap-4 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center group-hover:bg-[rgba(59,130,246,0.1)] transition-colors">
                  <Upload size={22} className="text-[var(--color-text-muted)] group-hover:text-[#60A5FA] transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold">Upload a car photo</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">JPG, PNG or WebP · Max 8MB</p>
                </div>
              </button>
            ) : (
              <div className="relative rounded-2xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedPreview} alt="Uploaded car" className="w-full max-h-72 object-cover" />
                <button
                  onClick={() => { setUploadedPreview(null); setUploadedImage(null); setAnalysis(null); }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors cursor-pointer"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileUpload}
            />

            {error && (
              <div className="mt-4 rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.15)] px-4 py-3 text-xs text-[var(--color-danger)]">
                {error}
              </div>
            )}

            <Button className="w-full mt-5 h-12 text-sm font-bold" onClick={handleAnalyze} loading={analyzing} disabled={!uploadedImage}>
              <Eye size={16} />
              {analyzing ? "Claude is analyzing..." : "Analyze Photo"}
            </Button>
          </div>

          {analysis && (
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden animate-in">
              <div className="px-6 py-5 border-b border-[var(--color-border)]">
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Detected Vehicle</p>
                <h3 className="text-lg font-bold">{analysis.detected_vehicle}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">{analysis.overall_assessment}</p>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[var(--color-border)] border-b border-[var(--color-border)]">
                {[
                  { label: "Color", value: analysis.color },
                  { label: "Condition", value: analysis.condition },
                  { label: "Stance", value: analysis.stance },
                ].map((item) => (
                  <div key={item.label} className="px-4 py-4 text-center">
                    <p className="text-[10px] text-[var(--color-text-muted)] mb-1">{item.label}</p>
                    <p className="text-xs font-semibold capitalize">{item.value || "—"}</p>
                  </div>
                ))}
              </div>

              {analysis.visible_mods?.length > 0 && (
                <div className="px-6 py-4 border-b border-[var(--color-border)]">
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Visible Mods</p>
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
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">AI Suggestions</p>
                  <div className="space-y-3">
                    {analysis.suggestions.map((s, i) => (
                      <div key={i} className="rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-bold">{s.name}</p>
                          <span
                            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: s.priority === "high" ? "rgba(255,69,58,0.1)" : s.priority === "medium" ? "rgba(255,159,10,0.1)" : "rgba(255,255,255,0.05)",
                              color: s.priority === "high" ? "#ff453a" : s.priority === "medium" ? "#ff9f0a" : "#555",
                            }}
                          >
                            {s.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <CategoryBadge category={s.category} className="text-[10px]" />
                          <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{s.estimated_cost}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">{s.reason}</p>
                        <div className="flex gap-2 flex-wrap">
                          {s.amazon_url && (
                            <a href={s.amazon_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(255,153,0,0.08)] border border-[rgba(255,153,0,0.15)] text-[10px] font-semibold text-[#FF9900] hover:bg-[rgba(255,153,0,0.15)] transition-colors">
                              <ShoppingCart size={10} /> Amazon <ExternalLink size={8} />
                            </a>
                          )}
                          {s.summit_url && (
                            <a href={s.summit_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[10px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-border-bright)] transition-colors">
                              Summit Racing <ExternalLink size={8} />
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
        <>
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-5"
            onClick={() => setExpandedRender(null)}
          >
            <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setExpandedRender(null)}
                className="absolute -top-12 right-0 w-10 h-10 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
              >
                <X size={16} className="text-white" />
              </button>
              {expandedRender.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={expandedRender.image_url}
                  alt={expandedRender.user_prompt}
                  className="w-full rounded-2xl"
                />
              )}
              <div className="mt-4 flex items-start justify-between gap-4">
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed flex-1">{expandedRender.user_prompt}</p>
                {expandedRender.image_url && (
                  <button
                    onClick={() => handleDownload(expandedRender)}
                    className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] transition-all cursor-pointer flex-shrink-0"
                  >
                    <Download size={13} /> Download
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="h-6" />
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
