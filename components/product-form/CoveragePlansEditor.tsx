import React from 'react';
import { type CoveragePlan, type HealthCoverageDetailItem, type CoverageItem } from '../../types';
import Input from '../ui/Input';

interface Props {
  plans: CoveragePlan[];
  onChange: (plans: CoveragePlan[]) => void;
  mode?: 'health' | 'simple';
  allowedItems?: { code: string; name: string; description?: string }[];
}

const CoveragePlansEditor: React.FC<Props> = ({ plans, onChange, mode = 'simple', allowedItems }) => {
  const updatePlan = (index: number, patch: Partial<CoveragePlan>) => {
    const next = [...plans];
    next[index] = { ...next[index], ...patch } as CoveragePlan;
    onChange(next);
  };

  const addPlan = () => {
    onChange([...(plans || []), { planType: '', coverageDetails: [] }]);
  };

  const removePlan = (index: number) => {
    const next = plans.filter((_, i) => i !== index);
    onChange(next);
  };

  const addDetail = (planIndex: number) => {
    const next = [...plans];
    if (mode === 'health') {
      const detail: HealthCoverageDetailItem = {
        item_code: '',
        item_name: '',
        description: '',
        details: { limit: 0, deductible: 0, reimbursement_ratio: 1, hospital_requirements: '', coverage_scope: '' }
      };
      next[planIndex] = { ...next[planIndex], coverageDetails: [...(next[planIndex].coverageDetails || []), detail] };
    } else {
      const detail: CoverageItem = { id: String(Date.now()), name: '', amount: '', details: '' };
      next[planIndex] = { ...next[planIndex], coverageDetails: [...(next[planIndex].coverageDetails || []), detail] } as any;
    }
    onChange(next);
  };

  const updateDetail = (planIndex: number, detailIndex: number, patch: any) => {
    const next = [...plans];
    const details = [...(next[planIndex].coverageDetails || [])];
    details[detailIndex] = { ...details[detailIndex], ...patch };
    next[planIndex] = { ...next[planIndex], coverageDetails: details } as any;
    onChange(next);
  };

  const updateDetailSpec = (planIndex: number, detailIndex: number, specPatch: Partial<HealthCoverageDetailItem['details']>) => {
    const next = [...plans];
    const details = [...(next[planIndex].coverageDetails || [])];
    details[detailIndex] = { ...details[detailIndex], details: { ...details[detailIndex].details, ...specPatch } };
    next[planIndex] = { ...next[planIndex], coverageDetails: details } as any;
    onChange(next);
  };

  const removeDetail = (planIndex: number, detailIndex: number) => {
    const next = [...plans];
    const details = [...(next[planIndex].coverageDetails || [])].filter((_, i) => i !== detailIndex);
    next[planIndex] = { ...next[planIndex], coverageDetails: details };
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">保障计划</h3>
        <button type="button" onClick={addPlan} className="px-3 py-1.5 text-sm font-semibold bg-brand-blue-600 text-white rounded hover:bg-brand-blue-700">新增计划</button>
      </div>

      {(plans || []).map((plan, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="计划名称" id={`planType-${index}`} name={`planType-${index}`} value={plan.planType || ''} onChange={e => updatePlan(index, { planType: e.target.value })} placeholder="例如：标准版/经典版/尊享版" required />
            <Input label="年度总保额" id={`annualLimit-${index}`} name={`annualLimit-${index}`} type="number" value={plan.annualLimit ?? 0} onChange={e => updatePlan(index, { annualLimit: parseFloat(e.target.value) || 0 })} placeholder="例如：3000000（300万）" />
            <Input label="保证续保年限" id={`grYears-${index}`} name={`grYears-${index}`} type="number" value={plan.guaranteedRenewalYears ?? 0} onChange={e => updatePlan(index, { guaranteedRenewalYears: parseInt(e.target.value, 10) || 0 })} placeholder="例如：3" />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-gray-800">保险责任</h4>
              <button type="button" onClick={() => addDetail(index)} className="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded hover:bg-black">新增责任</button>
            </div>

            {(plan.coverageDetails || []).map((detail: any, dIndex: number) => (
              <div key={dIndex} className="border border-gray-200 rounded p-3">
                {mode === 'health' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {allowedItems && allowedItems.length > 0 ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">责任编码 <span className="text-red-500">*</span></label>
                          <select value={detail.item_code} onChange={e => {
                            const code = e.target.value;
                            const matched = allowedItems.find(i => i.code === code);
                            const name = matched?.name || '';
                            const desc = matched?.description || '';
                            updateDetail(index, dIndex, { item_code: code, item_name: name, description: desc });
                          }} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white">
                            <option value="">请选择责任编码（来自条款已选责任）</option>
                            {allowedItems.map(i => (
                              <option key={i.code} value={i.code}>{i.code}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <Input label="责任编码" id={`item_code-${index}-${dIndex}`} name={`item_code-${index}-${dIndex}`} value={detail.item_code} onChange={e => updateDetail(index, dIndex, { item_code: e.target.value })} required />
                      )}
                      <Input label="责任名称" id={`item_name-${index}-${dIndex}`} name={`item_name-${index}-${dIndex}`} value={detail.item_name} onChange={e => updateDetail(index, dIndex, { item_name: e.target.value })} placeholder="例如：住院医疗费用/院外特药" required />
                      <Input label="说明" id={`description-${index}-${dIndex}`} name={`description-${index}-${dIndex}`} value={detail.description} onChange={e => updateDetail(index, dIndex, { description: e.target.value })} placeholder="简要描述，如：含住院、特殊门诊、外购药" />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">是否必选</label>
                        <select value={(detail as any).mandatory ? 'MANDATORY' : 'OPTIONAL'} onChange={e => updateDetail(index, dIndex, { mandatory: e.target.value === 'MANDATORY' })} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white">
                          <option value="MANDATORY">必选</option>
                          <option value="OPTIONAL">可选</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                      <Input label="保额上限(元)" id={`limit-${index}-${dIndex}`} name={`limit-${index}-${dIndex}`} type="number" value={detail.details.limit} onChange={e => updateDetailSpec(index, dIndex, { limit: parseInt(e.target.value, 10) || 0 })} placeholder="例如：3000000" />
                      <Input label="免赔额(元)" id={`deductible-${index}-${dIndex}`} name={`deductible-${index}-${dIndex}`} type="number" value={detail.details.deductible} onChange={e => updateDetailSpec(index, dIndex, { deductible: parseInt(e.target.value, 10) || 0 })} placeholder="例如：10000" />
                      <Input label="赔付比例" id={`ratio-${index}-${dIndex}`} name={`ratio-${index}-${dIndex}`} type="number" value={detail.details.reimbursement_ratio} onChange={e => updateDetailSpec(index, dIndex, { reimbursement_ratio: parseFloat(e.target.value) || 0 })} placeholder="比例小数，如1=100%，0.6=60%" />
                      <Input label="医院要求" id={`hospital-${index}-${dIndex}`} name={`hospital-${index}-${dIndex}`} value={detail.details.hospital_requirements} onChange={e => updateDetailSpec(index, dIndex, { hospital_requirements: e.target.value })} placeholder="如：二级及以上公立医院普通部/指定医院" />
                      <Input label="费用范围" id={`scope-${index}-${dIndex}`} name={`scope-${index}-${dIndex}`} value={detail.details.coverage_scope} onChange={e => updateDetailSpec(index, dIndex, { coverage_scope: e.target.value })} placeholder="如：住院费用/特殊门诊/外购药/门急诊" />
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Input label="责任名称" id={`item_name-${index}-${dIndex}`} name={`item_name-${index}-${dIndex}`} value={detail.name} onChange={e => updateDetail(index, dIndex, { name: e.target.value })} placeholder="例如：年金领取/身故保险金" required />
                    <Input label="保额/额度" id={`amount-${index}-${dIndex}`} name={`amount-${index}-${dIndex}`} value={detail.amount} onChange={e => updateDetail(index, dIndex, { amount: e.target.value })} placeholder="例如：300万/每月5000元" />
                    <Input label="说明" id={`desc-${index}-${dIndex}`} name={`desc-${index}-${dIndex}`} value={detail.details} onChange={e => updateDetail(index, dIndex, { details: e.target.value })} placeholder="简要描述，如：自起领日每年给付" />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">是否必选</label>
                      <select value={(detail as any).mandatory ? 'MANDATORY' : 'OPTIONAL'} onChange={e => updateDetail(index, dIndex, { mandatory: e.target.value === 'MANDATORY' })} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white">
                        <option value="MANDATORY">必选</option>
                        <option value="OPTIONAL">可选</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="flex justify-end mt-3">
                  <button type="button" onClick={() => removeDetail(index, dIndex)} className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded hover:bg-red-50">删除责任</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => removePlan(index)} className="px-3 py-1.5 text-sm font-semibold text-red-600 border border-red-200 rounded hover:bg-red-50">删除计划</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CoveragePlansEditor;
