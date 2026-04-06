import React from "react";

const OPTIONS = [
  { label: "今天", value: "1d" },
  { label: "7 天", value: "7d" },
  { label: "30 天", value: "30d" },
];

export default function AIPeriodSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1.5 text-sm transition ${
            value === option.value
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
