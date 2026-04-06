import React from "react";

export default function AISvgLineChart({
  items,
  color = "#0f172a",
}: {
  items: Array<{ label: string; value: number }>;
  color?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const points = items
    .map((item, index) => {
      const x = items.length === 1 ? 50 : (index / (items.length - 1)) * 100;
      const y = 100 - (item.value / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-2">
      <svg viewBox="0 0 100 100" className="h-40 w-full overflow-visible">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[11px] text-slate-500">
        {items.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}
