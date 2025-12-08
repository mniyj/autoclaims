import React from 'react';
import { type WholeLifeProduct } from '../../types';
import Input from '../ui/Input';
import CoveragePlansEditor from './CoveragePlansEditor';
import WholeLifeCoverageEditor from './WholeLifeCoverageEditor';

interface FormProps {
  product: WholeLifeProduct;
  onFormChange: (field: keyof WholeLifeProduct, value: any) => void;
}

const WholeLifeForm: React.FC<FormProps> = ({ product, onFormChange }) => {
    
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange(e.target.name as keyof WholeLifeProduct, e.target.value);
  };
    
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input label="有效保额增长率" id="effectiveAmountGrowthRate" name="effectiveAmountGrowthRate" type="number" step={0.0001} min={0} max={1} value={(product as any).effectiveAmountGrowthRate ?? 0} onChange={e => {
        const v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0))
        onFormChange('effectiveAmountGrowthRate', v)
      }} placeholder="例如：0.0175（1.75%）" required />
      <Input label="交费频率" id="paymentFrequency" name="paymentFrequency" value={product.paymentFrequency || ''} onChange={handleChange} placeholder="例如：年交/月交" required />
      <Input label="交费期间" id="paymentPeriod" name="paymentPeriod" value={product.paymentPeriod || ''} onChange={handleChange} placeholder="例如：趸交/3年/5年/10年" required />

      <div className="md:col-span-2 pt-4 border-t border-gray-200">
        <label className="block text-sm font-semibold text-gray-800 mb-2">减保规则</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">是否支持减保</label>
            <select value={(product as any).partialSurrenderRules?.is_available ? 'YES' : 'NO'} onChange={e => onFormChange('partialSurrenderRules', { ...(product as any).partialSurrenderRules, is_available: e.target.value === 'YES' })} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white">
              <option value="YES">支持</option>
              <option value="NO">不支持</option>
            </select>
          </div>
          <Input label="起始保单年度" id="ps_start" name="ps_start" type="number" value={(product as any).partialSurrenderRules?.start_policy_year ?? 0} onChange={e => onFormChange('partialSurrenderRules', { ...(product as any).partialSurrenderRules, start_policy_year: parseInt(e.target.value, 10) || 0 })} />
          <Input label="每年次数上限" id="ps_freq" name="ps_freq" type="number" value={(product as any).partialSurrenderRules?.frequency_per_year ?? 0} onChange={e => onFormChange('partialSurrenderRules', { ...(product as any).partialSurrenderRules, frequency_per_year: parseInt(e.target.value, 10) || 0 })} />
          <Input label="单次最低金额(元)" id="ps_min_amt" name="ps_min_amt" type="number" value={(product as any).partialSurrenderRules?.min_amount_per_request ?? 0} onChange={e => onFormChange('partialSurrenderRules', { ...(product as any).partialSurrenderRules, min_amount_per_request: parseFloat(e.target.value) || 0 })} />
          <Input label="单次最高比例" id="ps_max_ratio" name="ps_max_ratio" type="number" step={0.01} min={0} max={1} placeholder="例如：0.2（20%）" value={(product as any).partialSurrenderRules?.max_ratio_per_request ?? 0} onChange={e => {
            const v = Math.min(1, Math.max(0, parseFloat(e.target.value) || 0))
            onFormChange('partialSurrenderRules', { ...(product as any).partialSurrenderRules, max_ratio_per_request: v })
          }} />
          <Input label="最低剩余保费(元)" id="ps_min_remain" name="ps_min_remain" type="number" value={(product as any).partialSurrenderRules?.min_remaining_premium ?? 0} onChange={e => onFormChange('partialSurrenderRules', { ...(product as any).partialSurrenderRules, min_remaining_premium: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="mt-2">
          <Input label="减保规则说明" id="ps_desc" name="ps_desc" value={(product as any).partialSurrenderRules?.description || ''} onChange={e => onFormChange('partialSurrenderRules', { ...(product as any).partialSurrenderRules, description: e.target.value })} />
        </div>
      </div>

      <div className="md:col-span-2 pt-4 border-t border-gray-200">
        <WholeLifeCoverageEditor items={(product as any).coverageDetails || []} onChange={(items) => onFormChange('coverageDetails', items)} />
      </div>
    </div>
  );
};

export default WholeLifeForm;
