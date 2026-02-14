import React from 'react';
import { type RuleActionParams, RuleActionType } from '../../types';

interface ActionParamsEditorProps {
  actionType: RuleActionType;
  params: RuleActionParams;
  onChange: (params: RuleActionParams) => void;
  readOnly?: boolean;
}

const ActionParamsEditor: React.FC<ActionParamsEditorProps> = ({ actionType, params, onChange, readOnly }) => {
  const inputClass = 'text-sm border border-gray-300 rounded-md px-3 py-1.5 w-full disabled:bg-gray-100';
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

  const renderField = (label: string, key: keyof RuleActionParams, type: 'text' | 'number' = 'text', extra?: { min?: number; max?: number; step?: number }) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={String(params[key] ?? '')}
        onChange={(e) => onChange({ ...params, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
        disabled={readOnly}
        className={inputClass}
        min={extra?.min}
        max={extra?.max}
        step={extra?.step}
      />
    </div>
  );

  const renderContent = () => {
    switch (actionType) {
      case RuleActionType.REJECT_CLAIM:
      case RuleActionType.REJECT_ITEM:
        return renderField('拒赔原因代码', 'reject_reason_code');

      case RuleActionType.SET_CLAIM_RATIO:
      case RuleActionType.SET_ITEM_RATIO:
        return renderField('赔付比例 (0-1)', 'payout_ratio', 'number', { min: 0, max: 1, step: 0.01 });

      case RuleActionType.FLAG_FRAUD:
        return (
          <div className="space-y-3">
            {renderField('欺诈风险评分 (0-100)', 'fraud_risk_score', 'number', { min: 0, max: 100 })}
            {renderField('转人工原因', 'route_reason')}
          </div>
        );

      case RuleActionType.ROUTE_CLAIM_MANUAL:
        return renderField('转人工原因', 'route_reason');

      case RuleActionType.ADJUST_ITEM_AMOUNT:
        return (
          <div className="space-y-3">
            {renderField('调减比例 (0-1)', 'reduction_ratio', 'number', { min: 0, max: 1, step: 0.01 })}
            {params.pricing_reference !== undefined && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <p className="text-xs font-medium text-gray-600">定价参照</p>
                <div>
                  <label className={labelClass}>参照来源</label>
                  <input
                    type="text"
                    value={params.pricing_reference?.source ?? ''}
                    onChange={(e) => onChange({ ...params, pricing_reference: { ...params.pricing_reference!, source: e.target.value } })}
                    disabled={readOnly}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>容差百分比</label>
                  <input
                    type="number"
                    value={params.pricing_reference?.tolerance_percent ?? ''}
                    onChange={(e) => onChange({ ...params, pricing_reference: { ...params.pricing_reference!, tolerance_percent: Number(e.target.value) } })}
                    disabled={readOnly}
                    className={inputClass}
                    min={0}
                    max={100}
                  />
                </div>
              </div>
            )}
          </div>
        );

      case RuleActionType.APPLY_FORMULA:
        return (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>公式表达式</label>
              <textarea
                value={params.formula?.expression ?? ''}
                onChange={(e) => onChange({ ...params, formula: { expression: e.target.value, output_field: params.formula?.output_field ?? '' } })}
                disabled={readOnly}
                className={`${inputClass} font-mono text-xs`}
                rows={2}
              />
            </div>
            <div>
              <label className={labelClass}>输出字段</label>
              <input
                type="text"
                value={params.formula?.output_field ?? ''}
                onChange={(e) => onChange({ ...params, formula: { expression: params.formula?.expression ?? '', output_field: e.target.value } })}
                disabled={readOnly}
                className={inputClass}
              />
            </div>
          </div>
        );

      case RuleActionType.APPLY_CAP:
        return (
          <div className="space-y-3">
            {renderField('限额字段', 'cap_field')}
            {renderField('限额金额', 'cap_amount', 'number', { min: 0 })}
          </div>
        );

      case RuleActionType.APPLY_DEDUCTIBLE:
        return renderField('免赔额', 'deductible_amount', 'number', { min: 0 });

      case RuleActionType.ADD_REMARK:
        return (
          <div>
            <label className={labelClass}>备注模板</label>
            <textarea
              value={params.remark_template ?? ''}
              onChange={(e) => onChange({ ...params, remark_template: e.target.value })}
              disabled={readOnly}
              className={inputClass}
              rows={3}
            />
          </div>
        );

      case RuleActionType.FLAG_ITEM:
        return renderField('标记原因', 'route_reason');

      // Social insurance ratio
      default:
        if (params.social_insurance_ratio !== undefined || params.non_social_insurance_ratio !== undefined) {
          return (
            <div className="space-y-3">
              {renderField('社保已结算比例', 'social_insurance_ratio', 'number', { min: 0, max: 1, step: 0.01 })}
              {renderField('社保未结算比例', 'non_social_insurance_ratio', 'number', { min: 0, max: 1, step: 0.01 })}
            </div>
          );
        }

        // Disability grade table
        if (params.disability_grade_table) {
          return (
            <div>
              <label className={labelClass}>伤残等级赔付表</label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600">等级</th>
                      <th className="px-3 py-2 text-left text-gray-600">赔付比例</th>
                      {!readOnly && <th className="px-3 py-2 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {params.disability_grade_table.map((row, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-3 py-1.5">
                          <input type="number" value={row.grade} disabled={readOnly} className="w-16 text-xs border rounded px-2 py-1 disabled:bg-gray-100"
                            onChange={(e) => {
                              const newTable = [...params.disability_grade_table!];
                              newTable[idx] = { ...row, grade: Number(e.target.value) };
                              onChange({ ...params, disability_grade_table: newTable });
                            }}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" value={row.payout_ratio} step={0.01} disabled={readOnly} className="w-20 text-xs border rounded px-2 py-1 disabled:bg-gray-100"
                            onChange={(e) => {
                              const newTable = [...params.disability_grade_table!];
                              newTable[idx] = { ...row, payout_ratio: Number(e.target.value) };
                              onChange({ ...params, disability_grade_table: newTable });
                            }}
                          />
                        </td>
                        {!readOnly && (
                          <td className="px-1">
                            <button onClick={() => onChange({ ...params, disability_grade_table: params.disability_grade_table!.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!readOnly && (
                  <div className="p-2 border-t border-gray-100">
                    <button
                      onClick={() => onChange({ ...params, disability_grade_table: [...(params.disability_grade_table || []), { grade: 10, payout_ratio: 0.1 }] })}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >+ 添加行</button>
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Depreciation table
        if (params.depreciation_table) {
          return (
            <div>
              <label className={labelClass}>折旧表</label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600">起始月龄</th>
                      <th className="px-3 py-2 text-left text-gray-600">结束月龄</th>
                      <th className="px-3 py-2 text-left text-gray-600">月折旧率(%)</th>
                      {!readOnly && <th className="px-3 py-2 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {params.depreciation_table.map((row, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-3 py-1.5">
                          <input type="number" value={row.age_from_months} disabled={readOnly} className="w-16 text-xs border rounded px-2 py-1 disabled:bg-gray-100"
                            onChange={(e) => {
                              const newTable = [...params.depreciation_table!];
                              newTable[idx] = { ...row, age_from_months: Number(e.target.value) };
                              onChange({ ...params, depreciation_table: newTable });
                            }}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" value={row.age_to_months} disabled={readOnly} className="w-16 text-xs border rounded px-2 py-1 disabled:bg-gray-100"
                            onChange={(e) => {
                              const newTable = [...params.depreciation_table!];
                              newTable[idx] = { ...row, age_to_months: Number(e.target.value) };
                              onChange({ ...params, depreciation_table: newTable });
                            }}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" value={row.monthly_rate_percent} step={0.01} disabled={readOnly} className="w-20 text-xs border rounded px-2 py-1 disabled:bg-gray-100"
                            onChange={(e) => {
                              const newTable = [...params.depreciation_table!];
                              newTable[idx] = { ...row, monthly_rate_percent: Number(e.target.value) };
                              onChange({ ...params, depreciation_table: newTable });
                            }}
                          />
                        </td>
                        {!readOnly && (
                          <td className="px-1">
                            <button onClick={() => onChange({ ...params, depreciation_table: params.depreciation_table!.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!readOnly && (
                  <div className="p-2 border-t border-gray-100">
                    <button
                      onClick={() => onChange({ ...params, depreciation_table: [...(params.depreciation_table || []), { age_from_months: 0, age_to_months: 12, monthly_rate_percent: 0.6 }] })}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >+ 添加行</button>
                  </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <p className="text-xs text-gray-400">该动作类型无需额外参数</p>
        );
    }
  };

  return (
    <div className="space-y-3">
      {renderContent()}
    </div>
  );
};

export default ActionParamsEditor;
