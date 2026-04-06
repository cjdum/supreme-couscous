"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Zap, ImageIcon, Download, Upload, X, Eye, ShoppingCart, ExternalLink } from "lucide-react";
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

      setRenders((prev) => [json.render as Render, ...prev]);
      setPrompt("");
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
    a.download = `modvault-render-${render.id.slice(0, 8)}.svg`;
    a.click();
  }

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={18} className="text-[var(--color-accent)]" />
        <h1 className="text-xl font-bold">Visualizer</h1>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-5">
        AI renders your build or analyzes a photo for mod suggestions.
      </p>

      {/* Tab switcher */}
      <div className="flex bg-[var(--color-bg-elevated)] rounded-[14px] p-1 mb-5 gap-1">
        <button
          onClick={() => setActiveTab("render")}
          className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-[10px] text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "render"
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Zap size={13} />
          Generate SVG Render
        </button>
        <button
          onClick={() => setActiveTab("analyze")}
          className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-[10px] text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "analyze"
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Eye size={13} />
          Analyze a Photo
        </button>
      </div>

      {/* Render tab */}
      {activeTab === "render" && (
        <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 mb-6">
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
            hint="Be specific about stance, body mods, wheels, and color"
          />

          {error && (
            <div className="mt-3 rounded-[10px] bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-3 py-2.5 text-xs text-[var(--color-danger)]" role="alert">
              {error}
            </div>
          )}

          <Button className="w-full mt-4" onClick={handleGenerate} loading={loading} disabled={!selectedCarId || !prompt.trim()}>
            <Zap size={14} />
            {loading ? "Claude is generating…" : "Generate SVG Render"}
          </Button>

          {loading && (
            <p className="text-xs text-center text-[var(--color-text-muted)] mt-2">
              Usually takes 10–20 seconds…
            </p>
          )}
        </div>
      )}

      {/* Analyze tab */}
      {activeTab === "analyze" && (
        <div className="space-y-4 mb-6">
          <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
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

            {/* Upload zone */}
            {!uploadedPreview ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[var(--color-border)] rounded-[14px] p-8 flex flex-col items-center gap-3 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center group-hover:bg-[var(--color-accent-muted)] transition-colors">
                  <Upload size={20} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Upload a car photo</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">JPG, PNG or WebP · Max 8MB</p>
                </div>
              </button>
            ) : (
              <div className="relative rounded-[14px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedPreview} alt="Uploaded car" className="w-full max-h-64 object-cover" />
                <button
                  onClick={() => { setUploadedPreview(null); setUploadedImage(null); setAnalysis(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
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
              <div className="mt-3 rounded-[10px] bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.2)] px-3 py-2.5 text-xs text-[var(--color-danger)]">
                {error}
              </div>
            )}

            <Button
              className="w-full mt-4"
              onClick={handleAnalyze}
              loading={analyzing}
              disabled={!uploadedImage}
            >
              <Eye size={14} />
              {analyzing ? "Claude is analyzing…" : "Analyze Photo"}
            </Button>
          </div>

          {/* Analysis results */}
          {analysis && (
            <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden animate-in">
              {/* Vehicle info */}
              <div className="px-5 py-4 border-b border-[var(--color-border)]">
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Detected Vehicle</p>
                <h3 className="text-base font-bold">{analysis.detected_vehicle}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">{analysis.overall_assessment}</p>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 divide-x divide-[var(--color-border)] border-b border-[var(--color-border)]">
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Color</p>
                  <p className="text-xs font-semibold capitalize">{analysis.color || "—"}</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Condition</p>
                  <p className="text-xs font-semibold capitalize">{analysis.condition || "—"}</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Stance</p>
                  <p className="text-xs font-semibold capitalize truncate">{analysis.stance || "—"}</p>
                </div>
              </div>

              {/* Visible mods */}
              {analysis.visible_mods?.length > 0 && (
                <div className="px-5 py-3 border-b border-[var(--color-border)]">
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Visible Mods</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.visible_mods.map((mod, i) => (
                      <span key={i} className="tag bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions?.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">AI Suggestions</p>
                  <div className="space-y-3">
                    {analysis.suggestions.map((s, i) => (
                      <div key={i} className="rounded-[14px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-3.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-semibold">{s.name}</p>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: s.priority === "high" ? "var(--color-danger-muted)" : s.priority === "medium" ? "var(--color-warning-muted)" : "rgba(235,235,245,0.08)",
                              color: s.priority === "high" ? "var(--color-danger)" : s.priority === "medium" ? "var(--color-warning)" : "var(--color-text-muted)",
                            }}
                          >
                            {s.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <CategoryBadge category={s.category} className="text-[10px]" />
                          <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{s.estimated_cost}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-2">{s.reason}</p>
                        <div className="flex gap-2 flex-wrap">
                          {s.amazon_url && (
                            <a href={s.amazon_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(255,153,0,0.1)] border border-[rgba(255,153,0,0.2)] text-[10px] font-medium text-[#FF9900] hover:bg-[rgba(255,153,0,0.2)] transition-colors">
                              <ShoppingCart size={10} /> Amazon <ExternalLink size={8} />
                            </a>
                          )}
                          {s.summit_url && (
                            <a href={s.summit_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[10px] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)] transition-colors">
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

      {/* Renders gallery */}
      {activeTab === "render" && (
        <>
          <h2 className="text-sm font-bold mb-4">Render Gallery</h2>
          {loadingRenders ? (
            <div className="space-y-4">
              {[1, 2].map((i) => <div key={i} className="aspect-video skeleton rounded-[14px]" />)}
            </div>
          ) : renders.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-muted)]">
              <ImageIcon size={30} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No renders yet</p>
              <p className="text-xs mt-1 opacity-60">Your AI-generated renders will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {renders.map((render) => (
                <div key={render.id} className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
                  {render.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={render.image_url}
                      alt={`AI render: ${render.user_prompt}`}
                      className="w-full"
                      style={{ aspectRatio: "16/9", objectFit: "contain", background: "#000" }}
                    />
                  ) : (
                    <div className="bg-[var(--color-bg-elevated)] flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
                      <p className="text-xs text-[var(--color-text-muted)]">No image</p>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">{render.user_prompt}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{formatRelativeDate(render.created_at)}</p>
                    </div>
                    {render.image_url && (
                      <button
                        onClick={() => handleDownload(render)}
                        className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
                        aria-label="Download SVG"
                      >
                        <Download size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
