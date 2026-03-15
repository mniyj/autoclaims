import React from "react";

interface LedgerEntry {
  step: string;
  beforeAmount: number;
  afterAmount: number;
  reason: string;
  ruleId?: string;
}

interface LedgerItem {
  id: string;
  title: string;
  claimedAmount: number;
  payableAmount: number;
  status: "PAYABLE" | "ZERO_PAY" | "MANUAL_REVIEW";
  entries: LedgerEntry[];
}

interface ItemLedgerTimelineProps {
  items: LedgerItem[];
  onSelectRule?: (ruleId: string) => void;
}

function formatAmount(value: number) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_STYLES: Record<LedgerItem["status"], string> = {
  PAYABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ZERO_PAY: "bg-rose-50 text-rose-700 border-rose-200",
  MANUAL_REVIEW: "bg-slate-100 text-slate-700 border-slate-200",
};

const ItemLedgerTimeline: React.FC<ItemLedgerTimelineProps> = ({
  items,
  onSelectRule,
}) => {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        暂无赔付轨迹
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
              <div className="mt-1 text-xs text-gray-500">
                申报 {formatAmount(item.claimedAmount)} · 核定 {formatAmount(item.payableAmount)}
              </div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[item.status]}`}>
              {item.status === "PAYABLE" ? "可赔" : item.status === "ZERO_PAY" ? "不赔" : "人工复核"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {item.entries.map((entry, index) => (
              <div key={`${item.id}-${index}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="h-3 w-3 rounded-full bg-indigo-500"></span>
                  {index < item.entries.length - 1 && <span className="mt-1 h-full w-px bg-indigo-100"></span>}
                </div>
                <div className="flex-1 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">{entry.step}</div>
                    <div className="text-xs text-slate-500">
                      {formatAmount(entry.beforeAmount)} → {formatAmount(entry.afterAmount)}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{entry.reason}</div>
                  {entry.ruleId && (
                    <button
                      type="button"
                      onClick={() => onSelectRule?.(entry.ruleId!)}
                      className="mt-2 inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      查看规则 {entry.ruleId}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ItemLedgerTimeline;
