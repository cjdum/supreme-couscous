"use client";

import { useState } from "react";
import { Zap, Settings, Gauge, Weight, Timer, Activity, Edit2, Check, X, Cpu } from "lucide-react";
import type { Car } from "@/lib/supabase/types";

interface VehicleSpecsProps {
  car: Car;
  onUpdate?: (specs: Partial<Car>) => void;
}

type SpecKey = "horsepower" | "torque" | "engine_size" | "drivetrain" | "transmission" | "curb_weight" | "zero_to_sixty" | "top_speed";

interface SpecField {
  key: SpecKey;
  label: string;
  unit: string;
  icon: React.ReactNode;
  type: "number" | "text" | "select";
  options?: string[];
  color?: string;
  format?: (v: number | string) => string;
}

const SPEC_FIELDS: SpecField[] = [
  { key: "horsepower", label: "Horsepower", unit: "hp", icon: <Zap size={13} />, type: "number", color: "var(--color-warning)", format: (v) => `${v}` },
  { key: "torque", label: "Torque", unit: "lb-ft", icon: <Activity size={13} />, type: "number", color: "var(--color-success)", format: (v) => `${v}` },
  { key: "zero_to_sixty", label: "0–60 mph", unit: "sec", icon: <Timer size={13} />, type: "number", color: "var(--color-accent)", format: (v) => `${v}` },
  { key: "top_speed", label: "Top Speed", unit: "mph", icon: <Gauge size={13} />, type: "number", color: "var(--color-danger)", format: (v) => `${v}` },
  { key: "engine_size", label: "Engine", unit: "", icon: <Settings size={13} />, type: "text", color: "var(--color-text-secondary)" },
  { key: "drivetrain", label: "Drivetrain", unit: "", icon: <Cpu size={13} />, type: "select", options: ["RWD", "FWD", "AWD", "4WD"], color: "var(--color-text-secondary)" },
  { key: "curb_weight", label: "Weight", unit: "lbs", icon: <Weight size={13} />, type: "number", color: "var(--color-text-secondary)", format: (v) => Number(v).toLocaleString() },
  { key: "transmission", label: "Transmission", unit: "", icon: <Settings size={13} />, type: "text", color: "var(--color-text-secondary)" },
];

export function VehicleSpecs({ car, onUpdate }: VehicleSpecsProps) {
  const [editing, setEditing] = useState<SpecKey | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [guessingSpecs, setGuessingSpecs] = useState(false);
  const [localCar, setLocalCar] = useState<Car>(car);

  const hasSpecs = SPEC_FIELDS.some((f) => localCar[f.key] !== null && localCar[f.key] !== undefined);

  function startEdit(field: SpecField) {
    setEditing(field.key);
    setEditValue(String(localCar[field.key] ?? ""));
  }

  async function saveEdit(field: SpecField) {
    if (!editing) return;
    setLoading(true);

    const value = field.type === "number"
      ? (editValue === "" ? null : parseFloat(editValue))
      : editValue === "" ? null : editValue;

    try {
      const res = await fetch(`/api/cars/${car.id}/specs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field.key]: value }),
      });

      if (res.ok) {
        const updated = { ...localCar, [field.key]: value };
        setLocalCar(updated);
        onUpdate?.({ [field.key]: value });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setEditing(null);
    }
  }

  async function handleGuessSpecs() {
    setGuessingSpecs(true);
    try {
      const res = await fetch("/api/ai/vehicle-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: car.id }),
      });
      const json = await res.json();
      if (res.ok && json.specs) {
        setLocalCar((prev) => ({ ...prev, ...json.specs, specs_ai_guessed: true }));
        onUpdate?.(json.specs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGuessingSpecs(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold">Vehicle Specs</h3>
          {localCar.specs_ai_guessed && (
            <span className="tag bg-[var(--color-accent-muted)] text-[var(--color-accent-bright)]">AI estimated</span>
          )}
        </div>
        {!hasSpecs && (
          <button
            onClick={handleGuessSpecs}
            disabled={guessingSpecs}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent-bright)] hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {guessingSpecs ? (
              <>
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guessing…
              </>
            ) : (
              <>
                <Zap size={12} />
                AI guess specs
              </>
            )}
          </button>
        )}
        {hasSpecs && (
          <button
            onClick={handleGuessSpecs}
            disabled={guessingSpecs}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {guessingSpecs ? "Refreshing…" : "Refresh AI"}
          </button>
        )}
      </div>

      {!hasSpecs && !guessingSpecs ? (
        <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 text-center">
          <Zap size={24} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-40" />
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">No specs yet</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Tap &quot;AI guess specs&quot; to auto-fill, or click any field to edit manually.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SPEC_FIELDS.map((field) => {
            const value = localCar[field.key];
            const isEditing = editing === field.key;
            const displayValue = value !== null && value !== undefined
              ? (field.format ? field.format(value as number | string) : String(value))
              : null;

            return (
              <div
                key={field.key}
                className="spec-chip editable relative group"
                onClick={() => !isEditing && startEdit(field)}
              >
                {isEditing ? (
                  <div className="w-full" onClick={(e) => e.stopPropagation()}>
                    {field.type === "select" ? (
                      <select
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full bg-transparent text-center text-sm font-bold outline-none cursor-pointer"
                      >
                        <option value="">—</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        autoFocus
                        type={field.type === "number" ? "number" : "text"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(field);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="w-full bg-transparent text-center text-sm font-bold outline-none"
                        placeholder="—"
                        style={{ border: "none", padding: 0 }}
                      />
                    )}
                    <div className="flex justify-center gap-2 mt-2">
                      <button
                        onClick={() => saveEdit(field)}
                        disabled={loading}
                        className="text-[var(--color-success)] hover:opacity-80 cursor-pointer"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-[var(--color-text-muted)] hover:opacity-80 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1 mb-1" style={{ color: field.color }}>
                      {field.icon}
                      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
                        {field.label}
                      </span>
                    </div>
                    <p
                      className="text-base font-bold leading-tight"
                      style={{ color: displayValue ? (field.color ?? "var(--color-text-primary)") : "var(--color-text-disabled)" }}
                    >
                      {displayValue ?? "—"}
                    </p>
                    {field.unit && displayValue && (
                      <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{field.unit}</p>
                    )}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 size={10} className="text-[var(--color-text-muted)]" />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
