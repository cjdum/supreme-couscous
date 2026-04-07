"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { CarCard } from "./car-card";
import type { Car } from "@/lib/supabase/types";

interface CarsRailProps {
  cars: Car[];
  stats: Map<string, { count: number; total: number }>;
}

/**
 * Horizontal scroll rail of "other vehicles".
 * Supports drag-to-reorder via HTML5 drag events.
 * Order is local-only (UI sugar) — persistence would require a `position` column.
 */
export function CarsRail({ cars: initialCars, stats }: CarsRailProps) {
  const [cars, setCars] = useState(initialCars);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  function handleDragStart(id: string) {
    setDragging(id);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOver(id);
  }

  function handleDrop(targetId: string) {
    if (!dragging || dragging === targetId) {
      setDragging(null);
      setDragOver(null);
      return;
    }
    setCars((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((c) => c.id === dragging);
      const toIdx = next.findIndex((c) => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragging(null);
    setDragOver(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 -mx-5 px-5 sm:-mx-8 sm:px-8">
      {cars.map((car) => (
        <div
          key={car.id}
          draggable
          onDragStart={() => handleDragStart(car.id)}
          onDragOver={(e) => handleDragOver(e, car.id)}
          onDrop={() => handleDrop(car.id)}
          onDragEnd={() => { setDragging(null); setDragOver(null); }}
          className={`flex-shrink-0 relative transition-all duration-200 ${
            dragging === car.id ? "opacity-40 scale-95" : ""
          } ${dragOver === car.id && dragging !== car.id ? "scale-105" : ""}`}
          style={{ width: "200px" }}
        >
          <div className="absolute top-1.5 left-1.5 z-10 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical size={12} className="text-white/60" />
          </div>
          <CarCard
            car={car}
            modCount={stats.get(car.id)?.count ?? 0}
            totalSpent={stats.get(car.id)?.total ?? 0}
            isPrimary={false}
            compact
          />
        </div>
      ))}
    </div>
  );
}
