import React from "react";

interface FactInspectorProps {
  title: string;
  facts: Record<string, string | number | boolean>;
  focusedField?: string | null;
  onChange?: (key: string, value: string | number | boolean) => void;
}

function inferInputType(value: string | number | boolean) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "text";
}

const FactInspector: React.FC<FactInspectorProps> = ({
  title,
  facts,
  focusedField,
  onChange,
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4">
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    <div className="mt-4 space-y-3">
      {Object.entries(facts).map(([key, value]) => {
        const inputType = inferInputType(value);
        const highlighted = focusedField?.endsWith(key) || focusedField === key;
        return (
          <div
            key={key}
            className={`rounded-xl border px-3 py-2 transition-colors ${
              highlighted ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-slate-50"
            }`}
          >
            <div className="text-xs font-medium text-slate-500">{key}</div>
            {inputType === "boolean" ? (
              <select
                value={String(value)}
                onChange={(event) => onChange?.(key, event.target.value === "true")}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type={inputType === "number" ? "number" : "text"}
                value={String(value ?? "")}
                onChange={(event) =>
                  onChange?.(key, inputType === "number" ? Number(event.target.value) : event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            )}
          </div>
        );
      })}
    </div>
  </div>
);

export default FactInspector;
