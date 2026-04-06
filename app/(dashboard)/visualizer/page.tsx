"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, ImageIcon, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea, Select } from "@/components/ui/input";
import type { Car, Render } from "@/lib/supabase/types";
import { formatRelativeDate } from "@/lib/utils";

export default function VisualizerPage() {
  const searchParams = useSearchParams();
  const preselectedCarId = searchParams.get("carId");

  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState(preselectedCarId ?? "");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renders, setRenders] = useState<Render[]>([]);
  const [loadingRenders, setLoadingRenders] = useState(true);

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

  function handleDownload(render: Render) {
    if (!render.image_url) return;
    const a = document.createElement("a");
    a.href = render.image_url;
    a.download = `modvault-render-${render.id.slice(0, 8)}.svg`;
    a.click();
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={18} className="text-[var(--color-accent)]" />
        <h1 className="text-xl font-bold">AI Visualizer</h1>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-1">
        Describe your mods and Claude will generate a stylized SVG illustration of your build.
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mb-6">
        Powered entirely by Claude — no external image APIs needed.
      </p>

      {/* Input card */}
      <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 mb-6">
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
          placeholder="Wide body kit, Vossen wheels, Matte Chalk wrap, lowered on KW coilovers, carbon fiber front splitter and rear wing…"
          rows={4}
          hint="Be specific about stance, body mods, wheels, and color changes"
        />

        {error && (
          <div
            className="mt-3 rounded-[8px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] px-3 py-2.5 text-xs text-[var(--color-danger)]"
            role="alert"
          >
            {error}
          </div>
        )}

        <Button
          className="w-full mt-4"
          onClick={handleGenerate}
          loading={loading}
          disabled={!selectedCarId || !prompt.trim()}
        >
          <Sparkles size={14} />
          {loading ? "Claude is drawing…" : "Generate illustration"}
        </Button>

        {loading && (
          <p className="text-xs text-center text-[var(--color-text-muted)] mt-2">
            Claude is generating your SVG render — usually 5–15 seconds.
          </p>
        )}
      </div>

      {/* Renders gallery */}
      <h2 className="text-sm font-semibold mb-4">Render Gallery</h2>

      {loadingRenders ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="aspect-[16/9] skeleton rounded-[12px]" />
          ))}
        </div>
      ) : renders.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <ImageIcon size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No renders yet</p>
          <p className="text-xs mt-1 opacity-60">
            Your Claude-generated illustrations will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {renders.map((render) => (
            <div
              key={render.id}
              className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden"
            >
              {render.image_url ? (
                // SVG data URI renders natively as an image
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={render.image_url}
                  alt={`AI illustration: ${render.user_prompt}`}
                  className="w-full"
                  style={{ aspectRatio: "16/9", objectFit: "contain", background: "#09090b" }}
                />
              ) : (
                <div
                  className="bg-[var(--color-bg-elevated)] flex items-center justify-center"
                  style={{ aspectRatio: "16/9" }}
                >
                  <p className="text-xs text-[var(--color-text-muted)]">No image</p>
                </div>
              )}

              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
                    {render.user_prompt}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    {formatRelativeDate(render.created_at)}
                  </p>
                </div>
                {render.image_url && (
                  <button
                    onClick={() => handleDownload(render)}
                    className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
                    aria-label="Download SVG"
                    title="Download SVG"
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
  );
}
