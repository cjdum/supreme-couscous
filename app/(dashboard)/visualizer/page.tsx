"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Sparkles, ImageIcon, Download, Upload, X, Eye,
  Wand2, Check, Star, Loader2, Camera, AlertCircle, ArrowRight
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/input";
import { RenderLightbox } from "@/components/ui/render-lightbox";
import { haptic } from "@/lib/haptics";
import type { Car, Render, CarPhoto } from "@/lib/supabase/types";
import { formatRelativeDate } from "@/lib/utils";
import Link from "next/link";

/**
 * Lightweight markdown renderer for the streaming analyze response.
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
        parts.push(<strong key={idx++} className="font-bold text-white">{tok.slice(2, -2)}</strong>);
      } else {
        parts.push(<em key={idx++} className="italic">{tok.slice(1, -1)}</em>);
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
      blocks.push(<h4 key={`h-${i}`} className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mt-4 mb-1.5">{line.slice(4)}</h4>);
    } else if (line.startsWith("## ")) {
      flushList();
      blocks.push(<h3 key={`h-${i}`} className="text-sm font-black mt-5 mb-2 text-white">{line.slice(3)}</h3>);
    } else if (line.startsWith("# ")) {
      flushList();
      blocks.push(<h2 key={`h-${i}`} className="text-base font-black mt-5 mb-2 text-white">{line.slice(2)}</h2>);
    } else if (/^[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*]\s+/, ""));
    } else if (line === "") {
      flushList();
    } else {
      flushList();
      blocks.push(<p key={`p-${i}`} className="text-xs leading-relaxed text-[var(--color-text-secondary)] mb-2">{renderInline(line)}</p>);
    }
  }
  flushList();
  return blocks;
}

// ── Structured Mod Picker ──────────────────────────────────────────────────────

interface ModCategory {
  id: string;
  label: string;
  options: { value: string; label: string; promptFragment: string | null }[];
}

const MOD_CATEGORIES: ModCategory[] = [
  {
    id: "wheels",
    label: "Wheels",
    options: [
      { value: "stock", label: "Stock", promptFragment: null },
      { value: "deep-dish", label: "Deep Dish", promptFragment: "deep dish multi-piece forged wheels with aggressive offset that fills the arches" },
      { value: "multi-spoke", label: "Multi-Spoke", promptFragment: "multi-spoke lightweight forged wheels, polished lips" },
      { value: "mesh", label: "Mesh", promptFragment: "classic mesh-style wheels with chrome lips, flush fitment" },
      { value: "steelies", label: "Steelies", promptFragment: "old-school steel wheels with hub caps, understated sleeper look" },
    ],
  },
  {
    id: "bodykit",
    label: "Body Kit",
    options: [
      { value: "stock", label: "Stock", promptFragment: null },
      { value: "front-splitter", label: "Front Splitter", promptFragment: "aggressive carbon fiber front splitter and canards, clean factory body otherwise" },
      { value: "widebody", label: "Widebody", promptFragment: "full widebody kit with flared arches, wider track, stretched fitment" },
      { value: "lip-kit", label: "Lip Kit", promptFragment: "subtle lip kit — front lip, side skirts and rear diffuser, factory-plus look" },
      { value: "vented-hood", label: "Vented Hood", promptFragment: "functional vented carbon fiber hood with heat extractors" },
    ],
  },
  {
    id: "spoiler",
    label: "Spoiler",
    options: [
      { value: "none", label: "None", promptFragment: null },
      { value: "ducktail", label: "Ducktail", promptFragment: "tasteful ducktail spoiler in body color" },
      { value: "gt-wing", label: "GT Wing", promptFragment: "tall adjustable GT wing on trunk risers, track-focused" },
      { value: "carbon-oem", label: "Carbon OEM+", promptFragment: "carbon fiber OEM-style spoiler, factory fitment with premium finish" },
      { value: "whale-tail", label: "Whale Tail", promptFragment: "period-correct whale tail spoiler, wide and dramatic" },
    ],
  },
  {
    id: "exhaust",
    label: "Exhaust",
    options: [
      { value: "stock", label: "Stock", promptFragment: null },
      { value: "catback-single", label: "Catback Single", promptFragment: "aftermarket catback exhaust with single large tip, polished stainless" },
      { value: "catback-quad", label: "Quad Tips", promptFragment: "catback exhaust system with quad rectangular tips, premium finish" },
      { value: "side-exit", label: "Side Exit", promptFragment: "side-exit exhaust pipes emerging mid-sill, aggressive motorsport look" },
      { value: "straight-pipe", label: "Straight Pipe", promptFragment: "raw straight-piped exhaust, minimal and aggressive" },
    ],
  },
  {
    id: "tint",
    label: "Window Tint",
    options: [
      { value: "none", label: "None", promptFragment: null },
      { value: "light", label: "Light (30%)", promptFragment: "lightly tinted windows at 30% VLT, subtle privacy" },
      { value: "medium", label: "Medium (20%)", promptFragment: "medium window tint at 20% VLT, dark and purposeful" },
      { value: "dark", label: "Dark (5%)", promptFragment: "very dark window tint at 5% VLT, blacked-out glass effect" },
      { value: "limo", label: "Limo Tint", promptFragment: "limo-level black tint, fully opaque windows" },
    ],
  },
  {
    id: "ride",
    label: "Ride Height",
    options: [
      { value: "stock", label: "Stock", promptFragment: null },
      { value: "lowered", label: "Lowered", promptFragment: "lowered ride height on coilovers, 1–2 inch drop, slight negative camber" },
      { value: "slammed", label: "Slammed", promptFragment: "slammed stance on air suspension, nearly touching the ground, extreme negative camber" },
      { value: "lifted", label: "Lifted", promptFragment: "lifted on spacer leveling kit, all-terrain stance" },
      { value: "stance", label: "Stance", promptFragment: "stanced fitment — aggressive camber, stretched tires, tucked arches" },
    ],
  },
  {
    id: "paint",
    label: "Paint",
    options: [
      { value: "stock", label: "Keep Color", promptFragment: null },
      { value: "matte-black", label: "Matte Black", promptFragment: "full matte black respray, flat satin finish" },
      { value: "pearl-white", label: "Pearl White", promptFragment: "pearl white respray with subtle color-shift iridescence" },
      { value: "nardo-grey", label: "Nardo Grey", promptFragment: "Nardo grey respray, factory matte finish" },
      { value: "two-tone", label: "Two-Tone", promptFragment: "two-tone paint — black roof and hood, contrasting body color" },
    ],
  },
  {
    id: "livery",
    label: "Livery",
    options: [
      { value: "none", label: "None", promptFragment: null },
      { value: "racing-stripe", label: "Racing Stripe", promptFragment: "twin racing stripes over the hood and roof in contrasting color" },
      { value: "pinstripe", label: "Pinstripe", promptFragment: "subtle pinstripe detail along the lower body" },
      { value: "full-livery", label: "Full Livery", promptFragment: "motorsport-inspired full livery with sponsor graphics, number on door" },
      { value: "side-decal", label: "Side Decal", promptFragment: "minimal side skirt decal, tasteful script lettering" },
    ],
  },
];

type Selections = Record<string, string>;

function buildPrompt(car: Car, selections: Selections): string {
  const carLine = `${car.year} ${car.make} ${car.model}${car.trim ? " " + car.trim : ""}, ${car.color ?? "white"}`;

  const fragments: string[] = [];
  for (const cat of MOD_CATEGORIES) {
    const selected = selections[cat.id] ?? cat.options[0].value;
    const opt = cat.options.find((o) => o.value === selected);
    if (opt?.promptFragment) fragments.push(opt.promptFragment);
  }

  const modLine = fragments.length > 0 ? fragments.join(". ") + "." : "";

  return (
    `Pixel art sprite of a ${carLine}. 3/4 front driver side view. ` +
    (modLine ? modLine + " " : "") +
    `Retro 16-bit pixel art style. Hard square pixels, no anti-aliasing, no blur. ` +
    `Flat dark background #0a0a18. No text, no logos. Style: Super Nintendo racing game sprite.`
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

function VisualizerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedCarId = searchParams.get("carId");

  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState(preselectedCarId ?? "");
  const [carPhotos, setCarPhotos] = useState<CarPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<Render[]>([]);
  const [loadingRenders, setLoadingRenders] = useState(true);
  const [latestRender, setLatestRender] = useState<Render | null>(null);
  const [settingCover, setSettingCover] = useState(false);
  const [coverSet, setCoverSet] = useState(false);
  const [activeTab, setActiveTab] = useState<"render" | "analyze">("render");

  // Structured mod picker selections
  const defaultSelections: Selections = Object.fromEntries(
    MOD_CATEGORIES.map((c) => [c.id, c.options[0].value])
  );
  const [selections, setSelections] = useState<Selections>(defaultSelections);

  // Stock vs Modded comparison state
  const [stockImageUrl, setStockImageUrl] = useState<string | null>(null);
  const [moddedRender, setModdedRender] = useState<Render | null>(null);

  // Analyze tab
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedMediaType, setUploadedMediaType] = useState<"image/jpeg" | "image/png" | "image/webp" | "image/gif">("image/jpeg");
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedRender, setExpandedRender] = useState<Render | null>(null);

  const selectedCar = cars.find((c) => c.id === selectedCarId) ?? null;
  const carLabel = selectedCar ? `${selectedCar.year} ${selectedCar.make} ${selectedCar.model}` : "your car";

  // Car profile completeness gate
  const missingFields: string[] = [];
  if (selectedCar) {
    if (!selectedCar.year) missingFields.push("year");
    if (!selectedCar.make) missingFields.push("make");
    if (!selectedCar.model) missingFields.push("model");
    if (!selectedCar.trim) missingFields.push("trim");
    if (!selectedCar.color) missingFields.push("color");
  }
  const carProfileComplete = selectedCar != null && missingFields.length === 0;

  // Active selections (non-default)
  const activeSelections = Object.entries(selections).filter(([catId, val]) => {
    const cat = MOD_CATEGORIES.find((c) => c.id === catId);
    if (!cat) return false;
    const opt = cat.options.find((o) => o.value === val);
    return !!opt?.promptFragment;
  });

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

  // Load photos when car changes (used as stock reference)
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

  async function handleGenerate() {
    if (!selectedCarId || !carProfileComplete) return;
    setLoading(true);
    setError(null);
    setModdedRender(null);
    haptic("light");

    // Capture stock image before generating
    const stockPhoto = carPhotos.find((p) => p.is_cover) ?? carPhotos[0];
    setStockImageUrl(stockPhoto?.url ?? selectedCar?.cover_image_url ?? null);

    const prompt = buildPrompt(selectedCar!, selections);

    try {
      const res = await fetch("/api/ai/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: selectedCarId, prompt }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");

      const newRender = json.render as Render;
      setRenders((prev) => [newRender, ...prev]);
      setLatestRender(newRender);
      setModdedRender(newRender);
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

  function handleDownload(render: Render) {
    if (!render.image_url) return;
    const a = document.createElement("a");
    a.href = render.image_url;
    a.download = `modvault-render-${render.id.slice(0, 8)}.jpg`;
    a.click();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError("Image must be under 8MB"); return; }
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
        throw new Error((json as { error?: string }).error ?? "Analysis failed");
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

  return (
    <div className="px-5 sm:px-8 py-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-2xl bg-[var(--color-accent-muted)] flex items-center justify-center">
          <Wand2 size={18} className="text-[#60A5FA]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">Visualizer</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">Pick mods. See your build rendered.</p>
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
          Mod Visualizer
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

      {/* ── Render tab ── */}
      {activeTab === "render" && (
        <div className="space-y-6">
          {/* Car selector */}
          {cars.length > 0 && (
            <div className="max-w-xs">
              <Select
                label="Vehicle"
                value={selectedCarId}
                onChange={(e) => {
                  setSelectedCarId(e.target.value);
                  setModdedRender(null);
                  setStockImageUrl(null);
                }}
                options={cars.map((c) => ({
                  value: c.id,
                  label: `${c.year} ${c.make} ${c.model}${c.nickname ? ` (${c.nickname})` : ""}`,
                }))}
              />
            </div>
          )}

          {/* Profile gate */}
          {selectedCar && !carProfileComplete && (
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{
                background: "rgba(255,149,0,0.08)",
                border: "1px solid rgba(255,149,0,0.3)",
              }}
            >
              <AlertCircle size={16} className="text-[#ff9500] flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#ff9500]">Car profile incomplete</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Fill in <span className="text-white font-semibold">{missingFields.join(", ")}</span> before generating a render.
                </p>
                <Link
                  href={`/garage/${selectedCar.id}`}
                  className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-[#ff9500] hover:text-white transition-colors"
                >
                  Edit car profile <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          )}

          {/* Main layout: picker left, preview right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT: Structured mod picker */}
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 sm:p-6 space-y-5">
              <div>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                  Pick your mods
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Selections auto-build the DALL-E prompt — no typing needed.
                </p>
              </div>

              {/* Category pickers */}
              <div className="space-y-4">
                {MOD_CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <p
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 9, fontWeight: 800,
                        letterSpacing: "0.14em", textTransform: "uppercase",
                        color: "rgba(200,180,240,0.55)", marginBottom: 6,
                      }}
                    >
                      {cat.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cat.options.map((opt) => {
                        const isSelected = (selections[cat.id] ?? cat.options[0].value) === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() =>
                              setSelections((prev) => ({ ...prev, [cat.id]: opt.value }))
                            }
                            style={{
                              padding: "5px 11px",
                              borderRadius: 20,
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 10, fontWeight: 700,
                              letterSpacing: "0.06em",
                              cursor: "pointer",
                              transition: "all 120ms ease",
                              background: isSelected
                                ? "linear-gradient(135deg, rgba(123,79,212,0.55) 0%, rgba(168,85,247,0.45) 100%)"
                                : "var(--mv-panel-bg)",
                              border: `1px solid ${isSelected ? "rgba(168,85,247,0.6)" : "rgba(168,85,247,0.15)"}`,
                              color: isSelected ? "#e9d5ff" : "rgba(200,180,240,0.5)",
                              boxShadow: isSelected ? "0 0 10px rgba(168,85,247,0.2)" : "none",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Active selection chips */}
              {activeSelections.length > 0 && (
                <div>
                  <p
                    style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800,
                      letterSpacing: "0.14em", textTransform: "uppercase",
                      color: "rgba(200,180,240,0.55)", marginBottom: 6,
                    }}
                  >
                    Selected Mods
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSelections.map(([catId, val]) => {
                      const cat = MOD_CATEGORIES.find((c) => c.id === catId)!;
                      const opt = cat.options.find((o) => o.value === val)!;
                      return (
                        <span
                          key={catId}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "3px 9px", borderRadius: 12,
                            background: "rgba(59,130,246,0.12)",
                            border: "1px solid rgba(59,130,246,0.3)",
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                            color: "#93c5fd",
                          }}
                        >
                          <span style={{ color: "rgba(147,197,253,0.55)", fontWeight: 600 }}>{cat.label}:</span>
                          {opt.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-[var(--color-danger-muted)] border border-[rgba(255,69,58,0.15)] px-4 py-3 text-xs text-[var(--color-danger)]" role="alert">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!selectedCarId || !carProfileComplete || loading}
                className="w-full rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-[0_8px_32px_rgba(59,130,246,0.3)]"
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
                    Generate
                  </>
                )}
              </button>
              {loading && (
                <p className="text-[11px] text-center text-[var(--color-text-muted)]">
                  DALL-E rendering — takes ~20s
                </p>
              )}
            </div>

            {/* RIGHT: Stock vs Modded comparison / Preview */}
            <div className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 sm:p-6 flex flex-col gap-4">
              {moddedRender ? (
                <>
                  {/* Stock vs Modded */}
                  <p
                    style={{
                      fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 800,
                      letterSpacing: "0.14em", textTransform: "uppercase",
                      color: "rgba(200,180,240,0.55)",
                    }}
                  >
                    Stock vs Modded
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Stock */}
                    <div>
                      <p
                        style={{
                          fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700,
                          letterSpacing: "0.1em", textTransform: "uppercase",
                          color: "rgba(200,180,240,0.4)", marginBottom: 5,
                        }}
                      >
                        Stock
                      </p>
                      <div className="rounded-xl overflow-hidden border border-[var(--color-border)] aspect-square bg-[var(--color-bg-elevated)] flex items-center justify-center">
                        {stockImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={stockImageUrl} alt="Stock" className="w-full h-full object-cover" />
                        ) : (
                          <Camera size={20} className="text-[var(--color-text-disabled)]" />
                        )}
                      </div>
                    </div>
                    {/* Modded */}
                    <div>
                      <p
                        style={{
                          fontFamily: "ui-monospace, monospace", fontSize: 8, fontWeight: 700,
                          letterSpacing: "0.1em", textTransform: "uppercase",
                          color: "rgba(147,197,253,0.7)", marginBottom: 5,
                        }}
                      >
                        Modded
                      </p>
                      <button
                        onClick={() => setExpandedRender(moddedRender)}
                        className="w-full rounded-xl overflow-hidden border border-[rgba(59,130,246,0.35)] block cursor-pointer"
                        style={{ aspectRatio: "1", boxShadow: "0 0 14px rgba(59,130,246,0.25)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={moddedRender.image_url ?? ""}
                          alt="Modded"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    </div>
                  </div>

                  {/* Save to gallery */}
                  <button
                    onClick={() => setAsCover(moddedRender)}
                    disabled={settingCover || coverSet}
                    className="w-full min-h-[44px] h-11 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-bold flex items-center justify-center gap-2 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {settingCover ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : coverSet ? (
                      <>
                        <Check size={13} className="text-[var(--color-success)]" /> Saved as cover
                      </>
                    ) : (
                      <>
                        <Star size={13} /> Save to car gallery
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    {loading ? "Rendering..." : latestRender ? "Latest Render" : "Preview"}
                  </p>
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
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleDownload(latestRender)}
                            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-border-bright)] cursor-pointer"
                            aria-label="Download"
                          >
                            <Download size={14} className="text-[var(--color-text-secondary)]" />
                          </button>
                          <button
                            onClick={() => setAsCover(latestRender)}
                            disabled={settingCover || coverSet}
                            className="flex-1 min-h-[44px] h-11 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs font-bold flex items-center justify-center gap-2 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {settingCover ? <Loader2 size={13} className="animate-spin" /> :
                             coverSet ? <><Check size={13} className="text-[var(--color-success)]" /> Saved</> :
                             <><Star size={13} /> Set as cover</>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <ImageIcon size={32} className="mx-auto text-[var(--color-text-disabled)] mb-3" />
                        <p className="text-sm font-bold text-[var(--color-text-secondary)]">No render yet</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">Pick mods and tap Generate</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Render Gallery */}
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
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5">Pick mods above and generate your first render</p>
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
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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
                    <div className="p-4">
                      <p className="text-[10px] text-[var(--color-text-muted)]">{formatRelativeDate(render.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Analyze tab ── */}
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
                <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
              ) : (
                <><Eye size={16} /> Analyze Photo</>
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

      {/* Fullscreen lightbox */}
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
