import React, { useMemo, useState } from "react";
import type { InsuranceRuleset } from "../../types";
import { api } from "../../services/api";
import RulesetSummaryPanel from "./RulesetSummaryPanel";
import FactInspector from "./FactInspector";
import ValidationResultPanel from "./ValidationResultPanel";
import VersionDiffViewer from "./VersionDiffViewer";
import {
  buildValidationInput,
  buildValidationInputFromSnapshot,
  simulateRulesetValidation,
  transformFullReviewToValidationResult,
  type ValidationInputState,
  type ValidationSimulationResult,
} from "./workbenchUtils";

interface RulesetValidationWorkspaceProps {
  ruleset: InsuranceRuleset;
  previousRuleset: InsuranceRuleset | null;
  onBack: () => void;
}

type SourceMode = "sample" | "snapshot";

const RulesetValidationWorkspace: React.FC<RulesetValidationWorkspaceProps> = ({
  ruleset,
  previousRuleset,
  onBack,
}) => {
  const [sourceMode, setSourceMode] = useState<SourceMode>("sample");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [claimCaseId, setClaimCaseId] = useState("");
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [backendResult, setBackendResult] = useState<ValidationSimulationResult | null>(null);
  const [inputState, setInputState] = useState<ValidationInputState>(() =>
    buildValidationInput(ruleset),
  );

  const localValidationResult = useMemo(
    () => simulateRulesetValidation(ruleset, inputState),
    [ruleset, inputState],
  );
  const validationResult = backendResult || localValidationResult;

  const resetToMode = (mode: SourceMode) => {
    setSourceMode(mode);
    setSnapshotMessage(null);
    setBackendResult(null);
    const next = buildValidationInput(ruleset);
    if (mode === "snapshot") {
      next.missingFacts = ["claimCaseId"];
    }
    setInputState(next);
  };

  const loadSnapshot = async () => {
    if (!claimCaseId.trim()) {
      setSnapshotMessage("请先输入案件 ID");
      return;
    }

    setLoadingSnapshot(true);
    setSnapshotMessage(null);
    try {
      const snapshot = await api.claimDocuments.getByClaimCaseId(claimCaseId.trim());
      const next = buildValidationInputFromSnapshot(ruleset, snapshot);
      setInputState(next);
      setSourceMode("snapshot");
      const backend = await api.claims.fullReview({
        claimCaseId: claimCaseId.trim(),
        productCode: ruleset.policy_info.product_code,
        ruleset,
      });
      setBackendResult(transformFullReviewToValidationResult(ruleset, backend));
      setSnapshotMessage(
        snapshot?.aggregation
          ? `已载入案件 ${claimCaseId.trim()} 的材料聚合快照，并完成后端真实试跑`
          : `案件 ${claimCaseId.trim()} 暂无聚合结果，已用当前规则完成后端试跑`,
      );
    } catch (error) {
      setBackendResult(null);
      setSnapshotMessage(error instanceof Error ? error.message : "加载真实快照失败");
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const updateInputState = (updater: (prev: ValidationInputState) => ValidationInputState) => {
    setBackendResult(null);
    setInputState(updater);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">规则验证</h1>
            <p className="text-sm text-gray-500">用样例事实或案件快照试跑规则，并追踪结论与赔付轨迹。</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1">
          {[
            { id: "sample", label: "样例案件" },
            { id: "snapshot", label: "真实快照" },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => resetToMode(option.id as SourceMode)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                sourceMode === option.id ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <RulesetSummaryPanel ruleset={ruleset} />

      {sourceMode === "snapshot" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label className="text-xs font-medium text-slate-500">案件 ID</label>
              <input
                value={claimCaseId}
                onChange={(event) => setClaimCaseId(event.target.value)}
                placeholder="例如 claim-detail-1"
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={loadSnapshot}
              disabled={loadingSnapshot}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {loadingSnapshot ? "加载中..." : "加载真实快照"}
            </button>
          </div>
          {snapshotMessage && (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {snapshotMessage}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <div className="space-y-4">
          <FactInspector
            title="保单事实"
            facts={inputState.policy}
            focusedField={focusedField}
            onChange={(key, value) =>
              updateInputState((prev) => ({
                ...prev,
                policy: { ...prev.policy, [key]: value },
              }))
            }
          />
          <FactInspector
            title="案件事实"
            facts={inputState.claim}
            focusedField={focusedField}
            onChange={(key, value) =>
              updateInputState((prev) => ({
                ...prev,
                claim: { ...prev.claim, [key]: value },
              }))
            }
          />
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">费用 / 损失项</h3>
              <button
                type="button"
                onClick={() =>
                  updateInputState((prev) => ({
                    ...prev,
                    items: [
                      ...prev.items,
                      {
                        itemName: `新增项目 ${prev.items.length + 1}`,
                        amount: 100,
                      },
                    ],
                  }))
                }
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                + 添加项目
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {inputState.items.map((item, index) => (
                <FactInspector
                  key={`item-${index}`}
                  title={`项目 ${index + 1}`}
                  facts={item}
                  focusedField={focusedField}
                  onChange={(key, value) =>
                    updateInputState((prev) => ({
                      ...prev,
                      items: prev.items.map((current, itemIndex) =>
                        itemIndex === index ? { ...current, [key]: value } : current,
                      ),
                    }))
                  }
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">缺失事实提示</h3>
            <textarea
              value={inputState.missingFacts.join("\n")}
              onChange={(event) =>
                updateInputState((prev) => ({
                  ...prev,
                  missingFacts: event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                }))
              }
              rows={4}
              className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="每行一个字段，例如 claim.resultDate"
            />
          </div>
        </div>

        <ValidationResultPanel
          result={validationResult}
          onFocusField={(field) => setFocusedField(field)}
          onSelectRule={(ruleId) => setFocusedField(validationResult.matchedRules.find((item) => item.ruleId === ruleId)?.fields[0] || null)}
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">本版本 vs 上一版本</h2>
          <p className="mt-1 text-sm text-gray-500">对比规则变更范围，确认新增、修改和移除项。</p>
        </div>
        <VersionDiffViewer current={ruleset} previous={previousRuleset} />
      </div>
    </div>
  );
};

export default RulesetValidationWorkspace;
