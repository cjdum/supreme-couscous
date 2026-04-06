"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ChartItem {
  name: string;
  value: number;
  color: string;
}

interface SpendingChartProps {
  data: ChartItem[];
  total: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-[10px] bg-[#1a1a1f] border border-[#27272a] px-3 py-2 shadow-xl">
      <p className="text-xs text-[#a1a1aa] mb-0.5">{item.name}</p>
      <p className="text-sm font-semibold text-white">{formatCurrency(item.value)}</p>
    </div>
  );
}

export function SpendingChart({ data, total }: SpendingChartProps) {
  return (
    <div className="space-y-4">
      {/* Donut chart */}
      <div className="h-48 relative" aria-label="Spending breakdown by category">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={600}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs text-[#a1a1aa]">Total</p>
          <p className="text-base font-bold text-white">{formatCurrency(total)}</p>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2" role="list" aria-label="Category breakdown">
        {data
          .sort((a, b) => b.value - a.value)
          .map((item) => (
            <div key={item.name} className="flex items-center justify-between" role="listitem">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="text-xs text-[#a1a1aa]">{item.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium">{formatCurrency(item.value)}</span>
                <span className="text-[10px] text-[#52525b] w-8 text-right">
                  {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
