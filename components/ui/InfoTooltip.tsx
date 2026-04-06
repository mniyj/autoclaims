import React, { useState, useRef, useEffect } from "react";

export interface InfoTooltipDetail {
  label: string;
  value: string;
}

interface InfoTooltipProps {
  title: string;
  description?: string;
  details?: InfoTooltipDetail[];
  /** 弹出方向，默认 right */
  placement?: "right" | "left" | "bottom";
  className?: string;
}

/**
 * 内置字段 / 功能说明图标
 * 点击后弹出浮层，展示标题、描述和可选的补充信息。
 */
const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  description,
  details,
  placement = "right",
  className,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [open]);

  const placementClass: Record<string, string> = {
    right: "left-6 top-1/2 -translate-y-1/2",
    left: "right-6 top-1/2 -translate-y-1/2",
    bottom: "left-1/2 -translate-x-1/2 top-6",
  };

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={`ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
          open
            ? "bg-blue-500 text-white"
            : "bg-slate-200 text-slate-500 hover:bg-blue-100 hover:text-blue-600"
        }`}
        aria-label={`查看「${title}」的说明`}
      >
        i
      </button>

      {open && (
        <div
          className={`absolute ${placementClass[placement]} z-50 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            aria-label="关闭"
          >
            ✕
          </button>

          <div className="pr-6">
            <div className="font-semibold text-slate-900">{title}</div>
            {description && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            )}
          </div>

          {details && details.length > 0 && (
            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              {details.map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-xs">
                  <dt className="w-20 shrink-0 text-slate-400">{label}</dt>
                  <dd className="break-all text-slate-600">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
