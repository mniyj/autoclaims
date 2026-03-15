import React, { useMemo, useState } from "react";
import { type InsuranceRuleset } from "../../types";
import { PRODUCT_LINE_LABELS } from "../../constants";
import Pagination from "../ui/Pagination";
import {
  deriveRulesetHealth,
  type RulesetHealthSnapshot,
} from "./workbenchUtils";

interface RulesetListViewProps {
  rulesets: InsuranceRuleset[];
  initialSearchQuery?: string;
  onSelectRuleset: (ruleset: InsuranceRuleset) => void;
  onImport: () => void;
  onManualCreate: () => void;
  onExport: (ruleset: InsuranceRuleset) => void;
  onDelete: (rulesetId: string) => void;
  onDuplicate: (ruleset: InsuranceRuleset) => void;
  onValidate: (ruleset: InsuranceRuleset) => void;
  onPublish: (ruleset: InsuranceRuleset) => void;
}

const ITEMS_PER_PAGE = 6;

const healthToneClasses: Record<RulesetHealthSnapshot["validationTone"], string> = {
  passed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
};

const RulesetListView: React.FC<RulesetListViewProps> = ({
  rulesets,
  initialSearchQuery = "",
  onSelectRuleset,
  onImport,
  onManualCreate,
  onExport,
  onDelete,
  onDuplicate,
  onValidate,
  onPublish,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [productLineFilter, setProductLineFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [validationFilter, setValidationFilter] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    if (!initialSearchQuery) return;
    setSearchQuery(initialSearchQuery);
    setCurrentPage(1);
  }, [initialSearchQuery]);

  const products = useMemo(
    () =>
      [...new Set(rulesets.map((ruleset) => `${ruleset.policy_info.product_code}｜${ruleset.policy_info.product_name}`))]
        .sort(),
    [rulesets],
  );

  const filteredRulesets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rulesets.filter((ruleset) => {
      const health = deriveRulesetHealth(ruleset);
      const productToken = `${ruleset.policy_info.product_code}｜${ruleset.policy_info.product_name}`;
      const matchesQuery =
        !query ||
        ruleset.policy_info.product_name.toLowerCase().includes(query) ||
        ruleset.policy_info.product_code.toLowerCase().includes(query) ||
        ruleset.ruleset_id.toLowerCase().includes(query) ||
        ruleset.policy_info.insurer.toLowerCase().includes(query);
      const matchesProductLine = !productLineFilter || ruleset.product_line === productLineFilter;
      const matchesProduct = !productFilter || productToken === productFilter;
      const matchesValidation = !validationFilter || health.validationTone === validationFilter;
      const matchesVersion = !versionFilter || health.versionState === versionFilter;
      return (
        matchesQuery &&
        matchesProductLine &&
        matchesProduct &&
        matchesValidation &&
        matchesVersion
      );
    });
  }, [
    rulesets,
    searchQuery,
    productLineFilter,
    productFilter,
    validationFilter,
    versionFilter,
  ]);

  const totalPages = Math.ceil(filteredRulesets.length / ITEMS_PER_PAGE);
  const paginatedRulesets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRulesets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRulesets, currentPage]);

  const resetFilters = () => {
    setSearchQuery("");
    setProductLineFilter("");
    setProductFilter("");
    setValidationFilter("");
    setVersionFilter("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">规则中心</h1>
          <p className="mt-1 text-sm text-gray-500">
            维护规则包、责任代码、字段依赖和发布版本，并从列表直接进入验证。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onManualCreate}
            className="flex items-center space-x-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>手工创建</span>
          </button>
          <button
            onClick={onImport}
            className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>导入规则集</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 xl:grid-cols-[2.2fr_repeat(4,minmax(0,1fr))_auto]">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="搜索产品名称 / 产品编码 / 规则集 ID / 保险公司"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={productLineFilter}
            onChange={(event) => {
              setProductLineFilter(event.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">全部产品线</option>
            {Object.entries(PRODUCT_LINE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={productFilter}
            onChange={(event) => {
              setProductFilter(event.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">全部产品</option>
            {products.map((product) => {
              const [code, name] = product.split("｜");
              return (
                <option key={product} value={product}>
                  {code} · {name}
                </option>
              );
            })}
          </select>
          <select
            value={validationFilter}
            onChange={(event) => {
              setValidationFilter(event.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">全部规则状态</option>
            <option value="passed">已验证</option>
            <option value="warning">字段缺失</option>
            <option value="error">规则冲突</option>
          </select>
          <select
            value={versionFilter}
            onChange={(event) => {
              setVersionFilter(event.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">全部版本状态</option>
            <option value="published">已发布</option>
            <option value="draft">仅草稿</option>
          </select>
          <button
            onClick={resetFilters}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            重置
          </button>
        </div>
      </div>

      {paginatedRulesets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-16 text-center">
          <div className="text-sm text-gray-500">暂无符合条件的规则集</div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {paginatedRulesets.map((ruleset) => {
            const health = deriveRulesetHealth(ruleset);
            return (
              <div key={ruleset.ruleset_id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-gray-900">
                        {ruleset.policy_info.product_name}
                      </h3>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                        {PRODUCT_LINE_LABELS[ruleset.product_line]}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {ruleset.policy_info.product_code} · {ruleset.ruleset_id}
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${healthToneClasses[health.validationTone]}`}>
                    {health.validationLabel}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="责任项覆盖率" value={`${health.coverageCount}/${ruleset.policy_info.coverages?.length || 0 || health.coverageCount}`} />
                  <Metric label="规则数" value={String(ruleset.rules.length)} />
                  <Metric label="最新版本" value={`v${ruleset.metadata.version}`} />
                  <Metric label="发布时间" value={ruleset.metadata.published_at ? new Date(ruleset.metadata.published_at).toLocaleDateString("zh-CN") : "未发布"} />
                  <Metric label="最近验证" value={ruleset.metadata.latest_validation?.summary || health.versionLabel} wide />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => onSelectRuleset(ruleset)} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800">
                    查看
                  </button>
                  <button onClick={() => onDuplicate(ruleset)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                    复制新版本
                  </button>
                  <button onClick={() => onValidate(ruleset)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                    进入验证
                  </button>
                  <button onClick={() => onPublish(ruleset)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                    发布
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <div>{ruleset.policy_info.insurer}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onExport(ruleset)} className="hover:text-blue-600">
                      导出
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("确定要删除该规则集吗？此操作不可撤销。")) {
                          onDelete(ruleset.ruleset_id);
                        }
                      }}
                      className="hover:text-red-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; wide?: boolean }> = ({
  label,
  value,
  wide = false,
}) => (
  <div className={`rounded-xl bg-slate-50 px-3 py-2 ${wide ? "col-span-2" : ""}`}>
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 font-medium text-slate-900">{value}</div>
  </div>
);

export default RulesetListView;
