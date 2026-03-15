import React from "react";
import DecisionBadge from "./DecisionBadge";
import ManualReviewReasonList from "./ManualReviewReasonList";
import ItemLedgerTimeline from "./ItemLedgerTimeline";
import type { ValidationSimulationResult } from "./workbenchUtils";

interface ValidationResultPanelProps {
  result: ValidationSimulationResult;
  onFocusField?: (field: string) => void;
  onSelectRule?: (ruleId: string) => void;
}

const ValidationResultPanel: React.FC<ValidationResultPanelProps> = ({
  result,
  onFocusField,
  onSelectRule,
}) => (
  <div className="space-y-4">
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">执行结果</h3>
          <p className="mt-1 text-sm text-gray-500">{result.summary}</p>
        </div>
        <DecisionBadge decision={result.decision} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {result.coverageResults.map((item) => (
          <div key={item.coverageCode} className="rounded-xl bg-slate-50 px-3 py-3">
            <div className="text-xs text-slate-500">{item.coverageCode}</div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              ¥{Number(item.payableAmount).toLocaleString("zh-CN")}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              申报 ¥{Number(item.claimedAmount).toLocaleString("zh-CN")} · {item.status}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {result.executionSource === "BACKEND" ? "后端真实试跑" : "本地模拟"}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          结算模式：
          {result.settlementMode === "LOSS"
            ? "损失补偿账本"
            : result.settlementMode === "BENEFIT"
              ? "给付账本"
              : "混合账本"}
        </span>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          定损 ¥{Number(result.settlementBreakdown.lossPayableAmount || 0).toLocaleString("zh-CN")}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          给付 ¥{Number(result.settlementBreakdown.benefitPayableAmount || 0).toLocaleString("zh-CN")}
        </span>
      </div>
    </div>

    {result.explanationCards.length > 0 && (
      <div className="grid gap-4 md:grid-cols-3">
        {result.explanationCards.map((card) => (
          <div
            key={card.id}
            className={`rounded-2xl border p-4 ${
              card.tone === "danger"
                ? "border-rose-200 bg-rose-50"
                : card.tone === "warning"
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <h3
              className={`text-sm font-semibold ${
                card.tone === "danger"
                  ? "text-rose-700"
                  : card.tone === "warning"
                    ? "text-amber-700"
                    : "text-slate-700"
              }`}
            >
              {card.title}
            </h3>
            <div className="mt-3 space-y-2">
              {card.items.map((item, index) => (
                <div key={`${card.id}-${index}`} className="rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}

    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">责任解释</h3>
      <div className="mt-3 space-y-2">
        {result.matchedRules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            {result.manualReviewReasons.length > 0
              ? "当前未返回命中规则，请优先查看人工复核原因与问题提示"
              : "当前样例未命中规则"}
          </div>
        ) : (
          result.matchedRules.map((item) => (
            <div key={item.ruleId} className="rounded-xl border border-gray-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.ruleName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.ruleId} · {item.effect}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectRule?.(item.ruleId)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  定位规则
                </button>
              </div>
              {item.fields.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.fields.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => onFocusField?.(field)}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      {field}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>

    <ItemLedgerTimeline items={result.ledger} onSelectRule={onSelectRule} />

    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">问题提示</h3>
      <div className="mt-3 space-y-2">
        {result.issues.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            当前版本未发现静态校验问题
          </div>
        ) : (
          result.issues.map((issue) => (
            <div
              key={issue.id}
              className={`rounded-xl border px-3 py-2 text-sm ${
                issue.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <div className="font-medium">{issue.message}</div>
              {(issue.ruleId || issue.field) && (
                <div className="mt-1 text-xs opacity-80">
                  {issue.ruleId ? `规则 ${issue.ruleId}` : ""} {issue.field ? `· 字段 ${issue.field}` : ""}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>

    <ManualReviewReasonList reasons={result.manualReviewReasons} />
  </div>
);

export default ValidationResultPanel;
