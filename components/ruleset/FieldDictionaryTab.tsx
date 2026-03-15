import React, { useMemo, useState } from 'react';
import { type ClaimsMaterial, type FieldDefinition } from '../../types';
import {
  DOMAIN_LABELS,
  FIELD_DATA_TYPE_LABELS,
  FIELD_SCOPE_LABELS,
  FIELD_SOURCE_TYPE_LABELS,
} from '../../constants';

interface FieldDictionaryTabProps {
  dictionary: Record<string, FieldDefinition>;
  claimsMaterials: ClaimsMaterial[];
}

function collectSchemaFactBindings(
  fields: NonNullable<ClaimsMaterial["schemaFields"]> = [],
  prefix = '',
): Array<{ fact_id: string; field_key?: string }> {
  const bindings: Array<{ fact_id: string; field_key?: string }> = [];
  fields.forEach((field) => {
    const key = String(field.field_key || '').trim();
    if (!key) return;
    const path = prefix ? `${prefix}.${key}` : key;
    if (field.fact_id) {
      bindings.push({ fact_id: field.fact_id, field_key: path });
    }
    if (field.data_type === 'OBJECT' && field.children) {
      bindings.push(...collectSchemaFactBindings(field.children as NonNullable<ClaimsMaterial["schemaFields"]>, path));
    }
    if (field.data_type === 'ARRAY' && field.item_fields) {
      bindings.push(...collectSchemaFactBindings(field.item_fields as NonNullable<ClaimsMaterial["schemaFields"]>, `${path}[]`));
    }
  });
  return bindings;
}

const FieldDictionaryTab: React.FC<FieldDictionaryTabProps> = ({ dictionary, claimsMaterials }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('');

  const entries = useMemo(() => {
    let result = Object.entries(dictionary) as [string, FieldDefinition][];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(([key, def]) => key.toLowerCase().includes(q) || def.label.toLowerCase().includes(q));
    }
    if (sourceTypeFilter) {
      result = result.filter(([, def]) => (def.source_type || 'manual') === sourceTypeFilter);
    }
    return result;
  }, [dictionary, searchQuery, sourceTypeFilter]);

  const bindingsByFact = useMemo(() => {
    return claimsMaterials.reduce<Record<string, Array<{ materialId: string; materialName: string; fieldKey?: string }>>>((acc, material) => {
      const bindings = collectSchemaFactBindings((material.schemaFields || []) as NonNullable<ClaimsMaterial["schemaFields"]>);
      bindings.forEach((binding) => {
        const current = acc[binding.fact_id] || [];
        current.push({
          materialId: material.id,
          materialName: material.name,
          fieldKey: binding.field_key || binding.alias,
        });
        acc[binding.fact_id] = current;
      });
      return acc;
    }, {});
  }, [claimsMaterials]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        事实字段元数据已前置到“事实元数据中心”统一维护。这里仅展示当前规则集引用了哪些标准事实，以及这些事实已绑定到哪些理赔材料。
      </div>

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索标准事实字段..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={sourceTypeFilter}
          onChange={(e) => setSourceTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部来源类型</option>
          {Object.entries(FIELD_SOURCE_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {entries.map(([fieldKey, definition]) => {
          const bindings = bindingsByFact[fieldKey] || [];
          return (
            <section key={fieldKey} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-500">{fieldKey}</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">{definition.label}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                      {FIELD_DATA_TYPE_LABELS[definition.data_type] || definition.data_type}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                      {FIELD_SCOPE_LABELS[definition.scope] || definition.scope}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                      {FIELD_SOURCE_TYPE_LABELS[definition.source_type || 'manual'] || definition.source_type || 'manual'}
                    </span>
                    {definition.required_evidence && (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">需材料佐证</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">字段来源说明</div>
                  <div className="mt-2 text-sm text-slate-600">
                    {definition.derivation || definition.source_refs?.join('、') || definition.source || '未登记'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {definition.applicable_domains.map((domain) => (
                      <span key={domain} className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                        {DOMAIN_LABELS[domain] || domain}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">材料绑定</div>
                  {bindings.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-500">当前没有材料直接绑定这个事实字段。</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {bindings.map((binding) => (
                        <div key={`${binding.materialId}-${binding.fieldKey || ''}`} className="rounded-lg bg-white px-3 py-2">
                          <div className="text-sm font-medium text-slate-900">{binding.materialName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {binding.fieldKey ? `材料 schema 字段：${binding.fieldKey}` : '使用事实后缀生成 schema 字段'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default FieldDictionaryTab;
