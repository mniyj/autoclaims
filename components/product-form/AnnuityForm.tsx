import React from 'react';
import { type AnnuityProduct } from '../../types';
import Input from '../ui/Input';
import AnnuityPlansEditor from './AnnuityPlansEditor';

interface FormProps {
  product: AnnuityProduct;
  onFormChange: (field: keyof AnnuityProduct, value: any) => void;
}

const AnnuityForm: React.FC<FormProps> = ({ product, onFormChange }) => {
    
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? parseInt(value, 10) || 0 : value;
    onFormChange(name as keyof AnnuityProduct, finalValue);
  };
    
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input label="交费方式" id="paymentMethod" name="paymentMethod" value={product.paymentMethod} onChange={handleChange} placeholder="例如：趸交/期交" required/>
      <Input label="交费期间" id="paymentPeriod" name="paymentPeriod" value={product.paymentPeriod} onChange={handleChange} required />
      <Input label="领取频率" id="payoutFrequency" name="payoutFrequency" value={product.payoutFrequency} onChange={handleChange} placeholder="例如：年领, 月领" required />
      <Input label="领取年龄" id="payoutStartAge" name="payoutStartAge" type="number" value={product.payoutStartAge} onChange={handleChange} required />
      <div className="md:col-span-2">
        <Input label="投保职业" id="underwritingOccupation" name="underwritingOccupation" value={product.underwritingOccupation} onChange={handleChange} required />
      </div>
      <div className="md:col-span-2 pt-4 border-t border-gray-200">
        <AnnuityPlansEditor plans={(product as any).coveragePlans || []} onChange={(plans) => onFormChange('coveragePlans', plans)} />
      </div>
    </div>
  );
};

export default AnnuityForm;
