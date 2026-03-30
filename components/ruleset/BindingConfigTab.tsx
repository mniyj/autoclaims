import React, { useState } from "react";
import { type InsuranceRuleset, type RulesetBinding } from "../../types";

interface BindingConfigTabProps {
  ruleset: InsuranceRuleset;
  onUpdateRuleset: (updated: InsuranceRuleset) => void;
}

const emptyBinding: RulesetBinding = {
  product_codes: [],
  category_match: { primary: [], secondary: [] },
  keywords: [],
  match_priority: 10,
};

const BindingConfigTab: React.FC<BindingConfigTabProps> = ({ ruleset, onUpdateRuleset }) => {
  const binding = ruleset.binding || emptyBinding;
  const [newProductCode, setNewProductCode] = useState("");
  const [newPrimary, setNewPrimary] = useState("");
  const [newSecondary, setNewSecondary] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  const updateBinding = (patch: Partial<RulesetBinding>) => {
    onUpdateRuleset({ ...ruleset, binding: { ...binding, ...patch } });
  };

  const addTag = (field: "product_codes" | "keywords", value: string) => {
    if (!value.trim()) return;
    const current = binding[field] || [];
    if (current.includes(value.trim())) return;
    updateBinding({ [field]: [...current, value.trim()] });
  };

  const removeTag = (field: "product_codes" | "keywords", value: string) => {
    updateBinding({ [field]: (binding[field] || []).filter((v) => v !== value) });
  };

  const addCategoryTag = (level: "primary" | "secondary", value: string) => {
    if (!value.trim()) return;
    const cm = binding.category_match || { primary: [], secondary: [] };
    if (cm[level].includes(value.trim())) return;
    updateBinding({ category_match: { ...cm, [level]: [...cm[level], value.trim()] } });
  };

  const removeCategoryTag = (level: "primary" | "secondary", value: string) => {
    const cm = binding.category_match || { primary: [], secondary: [] };
    updateBinding({ category_match: { ...cm, [level]: cm[level].filter((v) => v !== value) } });
  };

  return (
    <div className="space-y-6">
      {/* Section: Exact product binding */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">精确绑定产品</h2>
        <p className="mt-1 text-sm text-gray-500">优先级最高，产品代码完全匹配时直接使用此规则集。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(binding.product_codes || []).map((code) => (
            <span key={code} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
              {code}
              <button onClick={() => removeTag("product_codes", code)} className="ml-1 text-indigo-400 hover:text-indigo-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newProductCode}
            onChange={(e) => setNewProductCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { addTag("product_codes", newProductCode); setNewProductCode(""); } }}
            placeholder="输入产品代码，回车添加"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => { addTag("product_codes", newProductCode); setNewProductCode(""); }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            添加
          </button>
        </div>
      </section>

      {/* Section: Category match */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">分类匹配</h2>
        <p className="mt-1 text-sm text-gray-500">精确绑定未命中时，按产品分类匹配。</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">一级分类</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(binding.category_match?.primary || []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {tag}
                  <button onClick={() => removeCategoryTag("primary", tag)} className="ml-1 text-blue-400 hover:text-blue-600">&times;</button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newPrimary}
                onChange={(e) => setNewPrimary(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addCategoryTag("primary", newPrimary); setNewPrimary(""); } }}
                placeholder="输入一级分类，回车添加"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button onClick={() => { addCategoryTag("primary", newPrimary); setNewPrimary(""); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">添加</button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">二级分类</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(binding.category_match?.secondary || []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                  {tag}
                  <button onClick={() => removeCategoryTag("secondary", tag)} className="ml-1 text-green-400 hover:text-green-600">&times;</button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newSecondary}
                onChange={(e) => setNewSecondary(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addCategoryTag("secondary", newSecondary); setNewSecondary(""); } }}
                placeholder="输入二级分类，回车添加"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button onClick={() => { addCategoryTag("secondary", newSecondary); setNewSecondary(""); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">添加</button>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Keyword match */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">关键词匹配</h2>
        <p className="mt-1 text-sm text-gray-500">分类匹配未命中时，按关键词在产品名称/分类文本中搜索。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(binding.keywords || []).map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
              {kw}
              <button onClick={() => removeTag("keywords", kw)} className="ml-1 text-amber-400 hover:text-amber-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { addTag("keywords", newKeyword); setNewKeyword(""); } }}
            placeholder="输入关键词，回车添加"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button onClick={() => { addTag("keywords", newKeyword); setNewKeyword(""); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">添加</button>
        </div>
      </section>

      {/* Section: Match priority */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">匹配优先级</h2>
        <p className="mt-1 text-sm text-gray-500">多个规则集都匹配时，数值越小优先级越高。</p>
        <div className="mt-4">
          <input
            type="number"
            min={1}
            max={99}
            value={binding.match_priority || 10}
            onChange={(e) => updateBinding({ match_priority: Number(e.target.value) || 10 })}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </section>
    </div>
  );
};

export default BindingConfigTab;
