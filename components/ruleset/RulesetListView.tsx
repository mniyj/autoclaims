import React, { useState, useMemo } from 'react';
import { type InsuranceRuleset, RulesetProductLine } from '../../types';
import { PRODUCT_LINE_LABELS, DOMAIN_LABELS } from '../../constants';
import Pagination from '../ui/Pagination';

interface RulesetListViewProps {
  rulesets: InsuranceRuleset[];
  onSelectRuleset: (ruleset: InsuranceRuleset) => void;
  onImport: () => void;
  onExport: (ruleset: InsuranceRuleset) => void;
  onDelete: (rulesetId: string) => void;
}

const ITEMS_PER_PAGE = 6;

const RulesetListView: React.FC<RulesetListViewProps> = ({ rulesets, onSelectRuleset, onImport, onExport, onDelete }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [productLineFilter, setProductLineFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRulesets = useMemo(() => {
    let result = rulesets;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.policy_info.product_name.toLowerCase().includes(q) ||
        r.ruleset_id.toLowerCase().includes(q) ||
        r.policy_info.insurer.toLowerCase().includes(q)
      );
    }
    if (productLineFilter) {
      result = result.filter(r => r.product_line === productLineFilter);
    }
    return result;
  }, [rulesets, searchQuery, productLineFilter]);

  const totalPages = Math.ceil(filteredRulesets.length / ITEMS_PER_PAGE);
  const paginatedRulesets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRulesets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRulesets, currentPage]);

  const handleExport = (e: React.MouseEvent, ruleset: InsuranceRuleset) => {
    e.stopPropagation();
    onExport(ruleset);
  };

  const handleDelete = (e: React.MouseEvent, rulesetId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除该规则集吗？此操作不可撤销。')) {
      onDelete(rulesetId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">规则集管理</h1>
        <button onClick={onImport} className="flex items-center space-x-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          <span>导入规则集</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="搜索产品名称/规则集ID/保险公司..."
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <select
            value={productLineFilter}
            onChange={(e) => { setProductLineFilter(e.target.value); setCurrentPage(1); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">全部产品线</option>
            {Object.entries(PRODUCT_LINE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          {(searchQuery || productLineFilter) && (
            <button onClick={() => { setSearchQuery(''); setProductLineFilter(''); setCurrentPage(1); }} className="text-sm text-gray-500 hover:text-gray-700">重置</button>
          )}
        </div>
      </div>

      {/* Cards grid */}
      {paginatedRulesets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedRulesets.map((rs) => (
            <div
              key={rs.ruleset_id}
              onClick={() => onSelectRuleset(rs)}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{rs.policy_info.product_name}</h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{rs.ruleset_id}</p>
                </div>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium shrink-0 ml-2">
                  {PRODUCT_LINE_LABELS[rs.product_line]}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">保险公司</span>
                  <span className="text-gray-700">{rs.policy_info.insurer}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">规则总数</span>
                  <span className="text-gray-700 font-medium">{rs.metadata.total_rules}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">版本</span>
                  <span className="text-gray-700">v{rs.metadata.version}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">生成方式</span>
                  <span className="text-gray-700">{rs.metadata.generated_by === 'AI_PARSING' ? 'AI解析' : rs.metadata.generated_by === 'MANUAL_ENTRY' ? '手动录入' : '混合'}</span>
                </div>
              </div>

              {/* Domain distribution bar */}
              {rs.metadata.rules_by_domain && (
                <div className="mb-3">
                  <div className="flex items-center space-x-1 text-xs text-gray-400 mb-1">
                    <span>按域分布</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                    {rs.metadata.rules_by_domain.eligibility > 0 && (
                      <div className="bg-blue-500" style={{ width: `${(rs.metadata.rules_by_domain.eligibility / rs.metadata.total_rules) * 100}%` }} title={`定责: ${rs.metadata.rules_by_domain.eligibility}`}></div>
                    )}
                    {rs.metadata.rules_by_domain.assessment > 0 && (
                      <div className="bg-green-500" style={{ width: `${(rs.metadata.rules_by_domain.assessment / rs.metadata.total_rules) * 100}%` }} title={`定损: ${rs.metadata.rules_by_domain.assessment}`}></div>
                    )}
                    {rs.metadata.rules_by_domain.post_process > 0 && (
                      <div className="bg-purple-500" style={{ width: `${(rs.metadata.rules_by_domain.post_process / rs.metadata.total_rules) * 100}%` }} title={`后处理: ${rs.metadata.rules_by_domain.post_process}`}></div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 mt-1 text-xs">
                    <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1"></span>{rs.metadata.rules_by_domain.eligibility}</span>
                    <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></span>{rs.metadata.rules_by_domain.assessment}</span>
                    <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-1"></span>{rs.metadata.rules_by_domain.post_process}</span>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {(rs.metadata.low_confidence_rules ?? 0) > 0 && (
                <div className="px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 mb-3">
                  <svg className="inline w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                  {rs.metadata.low_confidence_rules} 条低置信度规则
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">{new Date(rs.metadata.generated_at).toLocaleDateString('zh-CN')}</span>
                <div className="flex items-center space-x-2">
                  <button onClick={(e) => handleExport(e, rs)} className="text-xs text-gray-500 hover:text-blue-600" title="导出">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                  <button onClick={(e) => handleDelete(e, rs.ruleset_id)} className="text-xs text-gray-500 hover:text-red-600" title="删除">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-gray-500 mb-4">暂无规则集{searchQuery || productLineFilter ? '（已过滤）' : ''}</p>
          <button onClick={onImport} className="text-sm text-blue-600 hover:text-blue-800">导入第一个规则集</button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </div>
  );
};

export default RulesetListView;
