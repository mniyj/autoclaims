import React, { useState, useMemo } from 'react';
import { type FieldDefinition } from '../../types';
import { DOMAIN_LABELS, FIELD_SCOPE_LABELS, FIELD_DATA_TYPE_LABELS } from '../../constants';

interface FieldDictionaryTabProps {
  dictionary: Record<string, FieldDefinition>;
}

const FieldDictionaryTab: React.FC<FieldDictionaryTabProps> = ({ dictionary }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('');

  const entries = useMemo(() => {
    let result = Object.entries(dictionary) as [string, FieldDefinition][];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(([key, def]) =>
        key.toLowerCase().includes(q) || def.label.toLowerCase().includes(q)
      );
    }
    if (scopeFilter) {
      result = result.filter(([, def]) => def.scope === scopeFilter);
    }
    return result;
  }, [dictionary, searchQuery, scopeFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-3">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索字段键名或标签..."
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="">全部作用域</option>
          {Object.entries(FIELD_SCOPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">字段键名</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">标签</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">数据类型</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">作用域</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">适用域</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map(([key, def]) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{key}</td>
                <td className="px-4 py-2.5 text-gray-900">{def.label}</td>
                <td className="px-4 py-2.5">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                    {FIELD_DATA_TYPE_LABELS[def.data_type] || def.data_type}
                  </span>
                  {def.enum_values && def.enum_values.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {def.enum_values.map((ev) => (
                        <span key={ev.code} className="px-1 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{ev.label}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-600">{FIELD_SCOPE_LABELS[def.scope] || def.scope}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {def.applicable_domains.map((d) => (
                      <span key={d} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs">{DOMAIN_LABELS[d]}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{def.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">未找到匹配的字段</div>
        )}
      </div>

      <p className="text-xs text-gray-400">共 {entries.length} / {Object.keys(dictionary).length} 个字段</p>
    </div>
  );
};

export default FieldDictionaryTab;
