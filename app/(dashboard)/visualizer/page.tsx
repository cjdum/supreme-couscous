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

  // Image analysis
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedMediaType, setUploadedMediaType] = useState<string>("image/jpeg");
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<"render" | "analyze">("render");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expanded render view
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
    <div className="px-4 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-[10px] bg-[rgba(59,130,246,0.15)] flex items-center justify-center">
          <Wand2 size={15} className="text-[#60A5FA]" />
        </div>
        <h1 className="text-xl font-bold">Visualizer</h1>
      </div>
      <p className="text-sm text-[rgba(255,255,255,0.4)] mb-5 pl-[42px]">
        Describe your dream build — DALL-E 3 renders it in photorealistic detail.
      </p>

      {/* Tab switcher */}
      <div className="flex bg-[#1a1a1a] rounded-[14px] p-1 mb-5 gap-1">
        <button
          onClick={() => setActiveTab("render")}
          className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-[10px] text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "render"
              ? "bg-[#3B82F6] text-white shadow-sm"
              : "text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.7)]"
          }`}
        >
          <Sparkles size={13} />
          Generate Render
        </button>
        <button
          onClick={() => setActiveTab("analyze")}
          className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-[10px] text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "analyze"
              ? "bg-[#3B82F6] text-white shadow-sm"
              : "text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.7)]"
          }`}
        >
          <Eye size={13} />
          Analyze Photo
        </button>
      </div>

      {/* Render tab */}
      {activeTab === "render" && (
        <div className="space-y-4 mb-6">
          <div className="rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-5">
            {cars.length > 0 && (
              <div className="mb-4">
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
              placeholder="Wide body kit, Vossen wheels, matte chalk wrap, lowered on KW coilovers, carbon fiber splitter and rear wing…"
              rows={4}
              hint="The more specific you are, the better the result"
            />

            {/* Quick suggestions */}
            {promptSuggestions.length > 0 && !prompt && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.25)] uppercase tracking-wider mb-2">Quick styles</p>
                <div className="flex flex-wrap gap-1.5">
                  {promptSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrompt(s)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.4)] hover:border-[rgba(59,130,246,0.4)] hover:text-[rgba(255,255,255,0.7)] transition-all cursor-pointer"
                    >
                      {s.split(",")[0].trim()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-[10px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.15)] px-3 py-2.5 text-xs text-[#f87171]" role="alert">
                {error}
              </div>
            )}

            <Button className="w-full mt-4" onClick={handleGenerate} loading={loading} disabled={!selectedCarId || !prompt.trim()}>
              <Sparkles size={14} />
              {loading ? "Generating with DALL-E 3…" : "Generate Render"}
            </Button>

            {loading && (
              <p className="text-[11px] text-center text-[rgba(255,255,255,0.25)] mt-2">
                DALL-E 3 is rendering your build — usually 15–30 seconds
              </p>
            )}
          </div>

          {/* Render Gallery */}
          <div>
            <h2 className="text-sm font-bold mb-3">Render Gallery</h2>
            {loadingRenders ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="aspect-video skeleton rounded-[14px]" />)}
              </div>
            ) : renders.length === 0 ? (
              <div className="rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] py-14 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
                  <ImageIcon size={20} className="text-[rgba(255,255,255,0.15)]" />
                </div>
                <p className="text-sm font-semibold text-[rgba(255,255,255,0.45)]">No renders yet</p>
                <p className="text-xs text-[rgba(255,255,255,0.25)] mt-1">Describe your dream build above to generate your first render</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {renders.map((render) => (
                  <div
                    key={render.id}
                    className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#111111] overflow-hidden card-hover cursor-pointer"
                    onClick={() => setExpandedRender(render)}
                  >
                    {render.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={render.image_url}
                        alt={`AI render: ${render.user_prompt}`}
                        className="w-full object-cover"
                        style={{ aspectRatio: "16/9" }}
                      />
                    ) : (
                      <div className="bg-[#1a1a1a] flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
                        <p className="text-xs text-[rgba(255,255,255,0.25)]">No image available</p>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed line-clamp-2">{render.user_prompt}</p>
                        <p className="text-[10px] text-[rgba(255,255,255,0.25)] mt-1">{formatRelativeDate(render.created_at)}</p>
                      </div>
                      {render.image_url && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(render); }}
                          className="shrink-0 p-1.5 rounded-lg text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.7)] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
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
        <div className="space-y-4 mb-6">
          <div className="rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] p-5">
            {cars.length > 0 && (
              <div className="mb-4">
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
                className="w-full border-2 border-dashed border-[rgba(255,255,255,0.08)] rounded-[14px] p-8 flex flex-col items-center gap-3 hover:border-[#3B82F6] hover:bg-[rgba(59,130,246,0.04)] transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] flex items-center justify-center group-hover:bg-[rgba(59,130,246,0.1)] transition-colors">
                  <Upload size={20} className="text-[rgba(255,255,255,0.2)] group-hover:text-[#60A5FA] transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Upload a car photo</p>
                  <p className="text-xs text-[rgba(255,255,255,0.3)] mt-0.5">JPG, PNG or WebP · Max 8MB</p>
                </div>
              </button>
            ) : (
              <div className="relative rounded-[14px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedPreview} alt="Uploaded car" className="w-full max-h-64 object-cover" />
                <button
                  onClick={() => { setUploadedPreview(null); setUploadedImage(null); setAnalysis(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors cursor-pointer"
                >
                  <X size={13} className="text-white" />
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
              <div className="mt-3 rounded-[10px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.15)] px-3 py-2.5 text-xs text-[#f87171]">
                {error}
              </div>
            )}

            <Button className="w-full mt-4" onClick={handleAnalyze} loading={analyzing} disabled={!uploadedImage}>
              <Eye size={14} />
              {analyzing ? "Claude is analyzing…" : "Analyze Photo"}
            </Button>
          </div>

          {analysis && (
            <div className="rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[#111111] overflow-hidden animate-in">
              <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
                <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider mb-1">Detected Vehicle</p>
                <h3 className="text-base font-bold">{analysis.detected_vehicle}</h3>
                <p className="text-xs text-[rgba(255,255,255,0.5)] mt-1 leading-relaxed">{analysis.overall_assessment}</p>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.05)] border-b border-[rgba(255,255,255,0.05)]">
                {[
                  { label: "Color", value: analysis.color },
                  { label: "Condition", value: analysis.condition },
                  { label: "Stance", value: analysis.stance },
                ].map((item) => (
                  <div key={item.label} className="px-3 py-3 text-center">
                    <p className="text-[10px] text-[rgba(255,255,255,0.28)] mb-0.5">{item.label}</p>
                    <p className="text-xs font-semibold capitalize">{item.value || "—"}</p>
                  </div>
                ))}
              </div>

              {analysis.visible_mods?.length > 0 && (
                <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.05)]">
                  <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider mb-2">Visible Mods</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.visible_mods.map((mod, i) => (
                      <span key={i} className="tag bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.5)]">
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.suggestions?.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.28)] uppercase tracking-wider mb-3">AI Suggestions</p>
                  <div className="space-y-3">
                    {analysis.suggestions.map((s, i) => (
                      <div key={i} className="rounded-[14px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] p-3.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-semibold">{s.name}</p>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: s.priority === "high" ? "rgba(239,68,68,0.1)" : s.priority === "medium" ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.06)",
                              color: s.priority === "high" ? "#f87171" : s.priority === "medium" ? "#fbbf24" : "rgba(255,255,255,0.3)",
                            }}
                          >
                            {s.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <CategoryBadge category={s.category} className="text-[10px]" />
                          <span className="text-[10px] text-[rgba(255,255,255,0.3)] font-medium">{s.estimated_cost}</span>
                        </div>
                        <p className="text-xs text-[rgba(255,255,255,0.45)] leading-relaxed mb-2">{s.reason}</p>
                        <div className="flex gap-2 flex-wrap">
                          {s.amazon_url && (
                            <a href={s.amazon_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(255,153,0,0.08)] border border-[rgba(255,153,0,0.15)] text-[10px] font-medium text-[#FF9900] hover:bg-[rgba(255,153,0,0.15)] transition-colors">
                              <ShoppingCart size={9} /> Amazon <ExternalLink size={8} />
                            </a>
                          )}
                          {s.summit_url && (
                            <a href={s.summit_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-[10px] font-medium text-[rgba(255,255,255,0.4)] hover:border-[rgba(255,255,255,0.15)] transition-colors">
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
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setExpandedRender(null)}
          >
            <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setExpandedRender(null)}
                className="absolute -top-10 right-0 w-9 h-9 rounded-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] flex items-center justify-center hover:bg-[#222222] transition-colors cursor-pointer"
              >
                <X size={15} className="text-white" />
              </button>
              {expandedRender.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={expandedRender.image_url}
                  alt={expandedRender.user_prompt}
                  className="w-full rounded-[16px]"
                />
              )}
              <div className="mt-3 flex items-start justify-between gap-3">
                <p className="text-xs text-[rgba(255,255,255,0.45)] leading-relaxed flex-1">{expandedRender.user_prompt}</p>
                {expandedRender.image_url && (
                  <button
                    onClick={() => handleDownload(expandedRender)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-xs text-[rgba(255,255,255,0.55)] hover:text-white hover:border-[rgba(255,255,255,0.2)] transition-all cursor-pointer flex-shrink-0"
                  >
                    <Download size={12} /> Download
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
