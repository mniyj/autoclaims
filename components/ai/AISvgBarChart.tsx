import React from "react";

export default function AISvgBarChart({
  items,
  color = "#0f172a",
}: {
  items: Array<{ label: string; value: number }>;
  color?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none">
            <rect x="0" y="0" width="100" height="10" rx="5" fill="#e2e8f0" />
            <rect x="0" y="0" width={(item.value / max) * 100} height="10" rx="5" fill={color} />
          </svg>
        </div>
      ))}
    </div>
  );
}
