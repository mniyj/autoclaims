import React, { useState } from "react";
import {
  type InsuranceRuleset,
  type CoverageInferenceRule,
  type CoverageInference,
  type RuleConditions,
  type LeafCondition,
  type GroupCondition,
  ConditionLogic,
  ConditionOperator,
  ExecutionDomain,
} from "../../types";
import ConditionTreeBuilder from "./ConditionTreeBuilder";

interface CoverageInferenceTabProps {
  ruleset: InsuranceRuleset;
  onUpdateRuleset: (updated: InsuranceRuleset) => void;
}

function createEmptyRule(): CoverageInferenceRule {
  return {
    coverage_code: "",
    label: "",
    condition: {
      logic: ConditionLogic.AND,
      expressions: [
        {
          field: "",
          operator: ConditionOperator.EQ,
          value: "",
        } as LeafCondition,
      ],
    },
  };
}

function normalizeCondition(
  condition: RuleConditions | Record<string, unknown>,
): RuleConditions {
  if (condition && "logic" in condition && "expressions" in condition) {
    return condition as RuleConditions;
  }
  const raw = condition as Record<string, unknown>;
  if (Array.isArray(raw.all)) {
    return {
      logic: ConditionLogic.AND,
      expressions: raw.all as LeafCondition[],
    };
  }
  if (Array.isArray(raw.any)) {
    return {
      logic: ConditionLogic.OR,
      expressions: raw.any as LeafCondition[],
    };
  }
  return { logic: ConditionLogic.ALWAYS_TRUE, expressions: [] };
}

function summarizeCondition(
  condition: RuleConditions | Record<string, unknown>,
): string {
  const normalized = normalizeCondition(condition);
  if (
    normalized.logic === ConditionLogic.ALWAYS_TRUE ||
    normalized.expressions.length === 0
  ) {
    return "始终为真";
  }
  if (normalized.expressions.length === 1) {
    const expr = normalized.expressions[0];
    if ("field" in expr) {
      const leaf = expr as LeafCondition;
      return `${leaf.field || "?"} ${leaf.operator} ${leaf.value ?? ""}`;
    }
  }
  const logic = normalized.logic;
  return `${logic} (${normalized.expressions.length} 个条件)`;
}

const CoverageInferenceTab: React.FC<CoverageInferenceTabProps> = ({
  ruleset,
  onUpdateRuleset,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const inference: CoverageInference = ruleset.coverage_inference ?? {
    rules: [],
    default_coverage_code: null,
    default_label: null,
  };

  const updateInference = (next: CoverageInference) => {
    onUpdateRuleset({ ...ruleset, coverage_inference: next });
  };

  const handleUpdateRule = (index: number, updated: CoverageInferenceRule) => {
    const nextRules = inference.rules.map((r, i) =>
      i === index ? updated : r,
    );
    updateInference({ ...inference, rules: nextRules });
  };

  const handleDeleteRule = (index: number) => {
    const nextRules = inference.rules.filter((_, i) => i !== index);
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index)
      setEditingIndex(editingIndex - 1);
    updateInference({ ...inference, rules: nextRules });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const nextRules = [...inference.rules];
    [nextRules[index - 1], nextRules[index]] = [
      nextRules[index],
      nextRules[index - 1],
    ];
    if (editingIndex === index) setEditingIndex(index - 1);
    else if (editingIndex === index - 1) setEditingIndex(index);
    updateInference({ ...inference, rules: nextRules });
  };

  const handleMoveDown = (index: number) => {
    if (index >= inference.rules.length - 1) return;
    const nextRules = [...inference.rules];
    [nextRules[index], nextRules[index + 1]] = [
      nextRules[index + 1],
      nextRules[index],
    ];
    if (editingIndex === index) setEditingIndex(index + 1);
    else if (editingIndex === index + 1) setEditingIndex(index);
    updateInference({ ...inference, rules: nextRules });
  };

  const handleAddRule = () => {
    const nextRules = [...inference.rules, createEmptyRule()];
    updateInference({ ...inference, rules: nextRules });
    setEditingIndex(nextRules.length - 1);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              覆盖推断规则
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              按顺序匹配条件，命中第一条规则后返回对应的责任代码。
            </p>
          </div>
          <button
            onClick={handleAddRule}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            添加规则
          </button>
        </div>

        {inference.rules.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-6 py-8 text-center text-sm text-gray-400">
            暂无推断规则，点击「添加规则」开始配置。
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {inference.rules.map((rule, index) => {
              const isEditing = editingIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {rule.coverage_code || "(未设置代码)"}{" "}
                          {rule.label && (
                            <span className="text-gray-500">
                              &mdash; {rule.label}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          条件: {summarizeCondition(rule.condition)}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title="上移"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index >= inference.rules.length - 1}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title="下移"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() =>
                          setEditingIndex(isEditing ? null : index)
                        }
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                          isEditing
                            ? "bg-indigo-100 text-indigo-700"
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        }`}
                      >
                        {isEditing ? "收起" : "编辑"}
                      </button>
                      <button
                        onClick={() => handleDeleteRule(index)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                        title="删除"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">
                            责任代码 (coverage_code)
                          </label>
                          <input
                            type="text"
                            value={rule.coverage_code}
                            onChange={(e) =>
                              handleUpdateRule(index, {
                                ...rule,
                                coverage_code: e.target.value,
                              })
                            }
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="例如: ACCIDENTAL_DEATH"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">
                            标签 (label)
                          </label>
                          <input
                            type="text"
                            value={rule.label}
                            onChange={(e) =>
                              handleUpdateRule(index, {
                                ...rule,
                                label: e.target.value,
                              })
                            }
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="例如: 意外身故"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-700">
                          匹配条件
                        </label>
                        <ConditionTreeBuilder
                          conditions={normalizeCondition(rule.condition)}
                          onChange={(conditions) =>
                            handleUpdateRule(index, {
                              ...rule,
                              condition: conditions,
                            })
                          }
                          fieldDictionary={ruleset.field_dictionary}
                          currentDomain={ExecutionDomain.ELIGIBILITY}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">默认值</h2>
        <p className="mt-1 text-sm text-gray-500">
          当所有规则均未命中时，使用以下默认责任代码。
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              默认责任代码
            </label>
            <input
              type="text"
              value={inference.default_coverage_code ?? ""}
              onChange={(e) =>
                updateInference({
                  ...inference,
                  default_coverage_code: e.target.value || null,
                })
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="留空表示不设置默认值"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">
              默认标签
            </label>
            <input
              type="text"
              value={inference.default_label ?? ""}
              onChange={(e) =>
                updateInference({
                  ...inference,
                  default_label: e.target.value || null,
                })
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="留空表示不设置默认标签"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default CoverageInferenceTab;
