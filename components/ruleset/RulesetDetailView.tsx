import React, { useEffect, useMemo, useState } from "react";
import { type ClaimsMaterial, type InsuranceRuleset, type RulesetRule, RuleStatus, ExecutionDomain } from "../../types";
import RuleDetailModal from "./RuleDetailModal";
import RulesetSummaryPanel from "./RulesetSummaryPanel";
import RuleGroupSection from "./RuleGroupSection";
import VersionDiffViewer from "./VersionDiffViewer";
import FieldDictionaryTab from "./FieldDictionaryTab";
import {
  deriveRulesetHealth,
  getRuleSemantic,
  publishRuleset,
  validateRuleset,
} from "./workbenchUtils";

interface RulesetDetailViewProps {
  ruleset: InsuranceRuleset;
  previousRuleset: InsuranceRuleset | null;
  claimsMaterials: ClaimsMaterial[];
  initialFocusCoverageCode?: string;
  onBack: () => void;
  onUpdateRuleset: (updated: InsuranceRuleset) => void;
  onOpenValidation: (ruleset: InsuranceRuleset) => void;
  onPublish: (ruleset: InsuranceRuleset) => void;
  onCreateRule: (domain: ExecutionDomain) => void;
}

type DetailTab = "overview" | "fields" | "liability" | "settlement" | "publish";
type ViewMode = "business" | "technical";

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "总览" },
  { id: "fields", label: "字段与映射" },
  { id: "liability", label: "责任规则" },
  { id: "settlement", label: "定损 / 给付规则" },
  { id: "publish", label: "发布与版本" },
];

const RulesetDetailView: React.FC<RulesetDetailViewProps> = ({
  ruleset,
  previousRuleset,
  claimsMaterials,
  initialFocusCoverageCode,
  onBack,
  onUpdateRuleset,
  onOpenValidation,
  onPublish,
  onCreateRule,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [viewMode, setViewMode] = useState<ViewMode>("business");
  const [editingRule, setEditingRule] = useState<RulesetRule | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const health = useMemo(() => deriveRulesetHealth(ruleset), [ruleset]);
  const issues = useMemo(() => validateRuleset(ruleset), [ruleset]);

  useEffect(() => {
    if (!initialFocusCoverageCode) return;

    const hasLiabilityRules = ruleset.rules.some(
      (rule) =>
        rule.execution.domain === ExecutionDomain.ELIGIBILITY &&
        (rule.applies_to?.coverage_codes || []).includes(initialFocusCoverageCode),
    );
    const hasSettlementRules = ruleset.rules.some(
      (rule) =>
        rule.execution.domain !== ExecutionDomain.ELIGIBILITY &&
        (rule.applies_to?.coverage_codes || []).includes(initialFocusCoverageCode),
    );

    setActiveTab(
      hasLiabilityRules
        ? "liability"
        : hasSettlementRules
          ? "settlement"
          : "overview",
    );
  }, [initialFocusCoverageCode, ruleset.rules, ruleset.ruleset_id]);

  const groupedLiability = useMemo(() => {
    const liabilityRules = ruleset.rules.filter((rule) => rule.execution.domain === "ELIGIBILITY");
    return {
      gate: liabilityRules.filter((rule) => getRuleSemantic(rule).key === "gate"),
      trigger: liabilityRules.filter((rule) => getRuleSemantic(rule).key === "trigger"),
      exclusion: liabilityRules.filter((rule) => getRuleSemantic(rule).key === "exclusion"),
      adjustment: liabilityRules.filter((rule) => getRuleSemantic(rule).key === "adjustment"),
    };
  }, [ruleset.rules]);

  const groupedSettlement = useMemo(() => {
    const settlementRules = ruleset.rules.filter((rule) => rule.execution.domain !== "ELIGIBILITY");
    return {
      benefit: settlementRules.filter((rule) => getRuleSemantic(rule).key === "benefit"),
      item_eligibility: settlementRules.filter((rule) => getRuleSemantic(rule).key === "item_eligibility"),
      item_ratio: settlementRules.filter((rule) => getRuleSemantic(rule).key === "item_ratio"),
      item_pricing: settlementRules.filter((rule) => getRuleSemantic(rule).key === "item_pricing"),
      item_cap: settlementRules.filter((rule) => getRuleSemantic(rule).key === "item_cap"),
      item_flag: settlementRules.filter((rule) => getRuleSemantic(rule).key === "item_flag"),
      post_process: settlementRules.filter((rule) => getRuleSemantic(rule).key === "post_process"),
    };
  }, [ruleset.rules]);

  const handleToggleStatus = (ruleId: string) => {
    const nextRules = ruleset.rules.map((rule) =>
      rule.rule_id === ruleId
        ? {
            ...rule,
            status:
              rule.status === RuleStatus.EFFECTIVE ? RuleStatus.DISABLED : RuleStatus.EFFECTIVE,
          }
        : rule,
    );
    onUpdateRuleset({ ...ruleset, rules: nextRules });
  };

  const dependencyEntries = useMemo(() => {
    return Object.entries(ruleset.field_dictionary).slice(0, 14);
  }, [ruleset.field_dictionary]);

  const canPublish = issues.every((issue) => issue.tone !== "error");
  const mappingCount = ruleset.field_mappings?.length || 0;

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
            <h1 className="text-xl font-bold text-gray-900">规则设计视图</h1>
            <p className="mt-1 text-sm text-gray-500">
              先读总览，再按责任或定损阶段维护规则，发布前进入验证工作台。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
            {[
              { id: "business", label: "业务模式" },
              { id: "technical", label: "技术模式" },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id as ViewMode)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  viewMode === mode.id ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onOpenValidation(ruleset)}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            进入验证
          </button>
          <button
            onClick={() => canPublish && onPublish(publishRuleset(ruleset))}
            disabled={!canPublish}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            发布
          </button>
        </div>
      </div>

      <RulesetSummaryPanel ruleset={ruleset} health={health} />

      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-3 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">产品与责任总览</h2>
              {initialFocusCoverageCode && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  当前从案件缺口跳转，正在聚焦责任代码 <span className="font-semibold">{initialFocusCoverageCode}</span>。
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoCard label="产品编码" value={ruleset.policy_info.product_code} />
                <InfoCard label="保险公司" value={ruleset.policy_info.insurer} />
                <InfoCard label="生效日期" value={ruleset.policy_info.effective_date} />
                <InfoCard label="终止日期" value={ruleset.policy_info.expiry_date} />
              </div>

              <div className="mt-5">
                <h3 className="text-sm font-semibold text-gray-900">责任代码清单</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ruleset.policy_info.coverages.map((coverage) => (
                    <span
                      key={coverage.coverage_code}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        initialFocusCoverageCode === coverage.coverage_code
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                          : "bg-indigo-50 text-indigo-700"
                      }`}
                    >
                      {coverage.coverage_code}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">关键字段依赖</h2>
              <div className="mt-2 text-sm text-slate-500">已登记 {Object.keys(ruleset.field_dictionary).length} 个标准事实字段，配置 {mappingCount} 条来源映射。</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {dependencyEntries.map(([field, definition]) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => setFocusedField(field)}
                    className={`rounded-xl border px-4 py-3 text-left ${
                      focusedField === field ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-medium text-slate-500">{field}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{definition.label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {definition.data_type} · {definition.scope} · {definition.source_type || definition.source}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">最近验证结果</h2>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-medium text-slate-900">
                  {ruleset.metadata.latest_validation?.summary || health.validationLabel}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {ruleset.metadata.latest_validation?.validated_at
                    ? `最近验证时间 ${new Date(ruleset.metadata.latest_validation.validated_at).toLocaleString("zh-CN")}`
                    : "尚未执行验证"}
                </div>
              </div>
              <button
                onClick={() => onOpenValidation(ruleset)}
                className="mt-4 w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                打开执行验证视图
              </button>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">当前版本状态</h2>
              <div className="mt-4 space-y-3">
                <InfoLine label="版本状态" value={health.versionLabel} />
                <InfoLine label="最近发布时间" value={ruleset.metadata.published_at ? new Date(ruleset.metadata.published_at).toLocaleString("zh-CN") : "未发布"} />
                <InfoLine label="最近发布人" value={ruleset.metadata.published_by || "未记录"} />
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === "fields" && (
        <FieldDictionaryTab
          dictionary={ruleset.field_dictionary}
          claimsMaterials={claimsMaterials}
        />
      )}

      {activeTab === "liability" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => onCreateRule(ExecutionDomain.ELIGIBILITY)}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              新增责任规则
            </button>
          </div>
          <RuleGroupSection
            title="准入"
            description="保障期间、保单状态、等待期等前置条件。只能在组内调整顺序。"
            rules={groupedLiability.gate}
            mode={viewMode}
            emptyText="暂无准入规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
          <RuleGroupSection
            title="触发"
            description="责任成立的关键触发条件，至少命中后才进入赔付或定损。"
            rules={groupedLiability.trigger}
            mode={viewMode}
            emptyText="暂无触发规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
          <RuleGroupSection
            title="免责"
            description="命中即拒赔或终止责任，不允许拖到触发组。"
            rules={groupedLiability.exclusion}
            mode={viewMode}
            emptyText="暂无免责规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
          <RuleGroupSection
            title="调整"
            description="责任成立后对赔付比例或复核策略进行调整。"
            rules={groupedLiability.adjustment}
            mode={viewMode}
            emptyText="暂无调整规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
        </div>
      )}

      {activeTab === "settlement" && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => onCreateRule(ExecutionDomain.ASSESSMENT)}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              新增定损规则
            </button>
            <button
              onClick={() => onCreateRule(ExecutionDomain.POST_PROCESS)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              新增后处理规则
            </button>
          </div>
          <RuleGroupSection
            title="给付型规则"
            description="适用于定额或比例给付场景。"
            rules={groupedSettlement.benefit}
            mode={viewMode}
            emptyText="暂无给付型规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
          <RuleGroupSection
            title="费用项准入"
            description="控制哪些费用或损失项可以进入账本。"
            rules={groupedSettlement.item_eligibility}
            mode={viewMode}
            emptyText="暂无费用项准入规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
          <RuleGroupSection
            title="比例规则"
            description="对已准入的费用项应用赔付比例。"
            rules={groupedSettlement.item_ratio}
            mode={viewMode}
            emptyText="暂无比例规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
          <RuleGroupSection
            title="限价规则"
            description="按参考价、物价标准或核损结果调整单项金额。"
            rules={groupedSettlement.item_pricing}
            mode={viewMode}
            emptyText="暂无限价规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
          <RuleGroupSection
            title="限额规则"
            description="应用免赔额、子限额或保额上限。"
            rules={groupedSettlement.item_cap}
            mode={viewMode}
            emptyText="暂无限额规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
          <RuleGroupSection
            title="复核标记"
            description="保留金额结果，但向审核员标记需要人工确认的项目。"
            rules={groupedSettlement.item_flag}
            mode={viewMode}
            emptyText="暂无复核标记规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
          <RuleGroupSection
            title="后处理"
            description="做案件级补充调整、备注或汇总。"
            rules={groupedSettlement.post_process}
            mode={viewMode}
            emptyText="暂无后处理规则"
            onEdit={setEditingRule}
            onToggleStatus={handleToggleStatus}
            onFocusField={setFocusedField}
          />
        </div>
      )}

      {activeTab === "publish" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">发布门禁</h2>
                <p className="mt-1 text-sm text-gray-500">
                  有高优先级字段错误时禁止发布，建议先进入验证工作台处理。
                </p>
              </div>
              <button
                onClick={() => canPublish && onPublish(publishRuleset(ruleset))}
                disabled={!canPublish}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                发布当前版本
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {issues.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  发布前校验通过，可直接发布。
                </div>
              ) : (
                issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`rounded-xl border px-4 py-3 text-sm ${
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
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">版本差异</h2>
            <p className="mt-1 text-sm text-gray-500">
              对比当前版本与上一版本的新增、变更和移除内容。
            </p>
            <div className="mt-4">
              <VersionDiffViewer current={ruleset} previous={previousRuleset} />
            </div>
          </section>
        </div>
      )}

      <RuleDetailModal
        isOpen={!!editingRule}
        onClose={() => setEditingRule(null)}
        rule={editingRule}
        fieldDictionary={ruleset.field_dictionary}
        onSave={(updatedRule) => {
          const nextRules = ruleset.rules.map((rule) =>
            rule.rule_id === updatedRule.rule_id ? updatedRule : rule,
          );
          onUpdateRuleset({ ...ruleset, rules: nextRules });
          setEditingRule(null);
        }}
      />
    </div>
  );
};

const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-4 py-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
  </div>
);

const InfoLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-900">{value}</span>
  </div>
);

export default RulesetDetailView;
