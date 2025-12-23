import React from 'react';
import { type TermLifeProduct } from '../../types';
import Input from '../ui/Input';

interface FormProps {
  product: TermLifeProduct;
  onFormChange: (field: keyof TermLifeProduct, value: any) => void;
}

const TermLifeForm: React.FC<FormProps> = ({ product, onFormChange }) => {
    
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? parseFloat(value) || 0 : value;
    onFormChange(name as keyof TermLifeProduct, finalValue);
  };
    
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input label="基本保额" id="basicSumAssured" name="basicSumAssured" type="number" value={product.basicSumAssured} onChange={handleChange} required />
      <Input label="交费期间" id="paymentPeriod" name="paymentPeriod" value={product.paymentPeriod} onChange={handleChange} required />
      <div className="md:col-span-2">
        <Input label="承保职业" id="underwritingOccupation" name="underwritingOccupation" value={product.underwritingOccupation} onChange={handleChange} required />
      </div>
    </div>
  );
};

export default TermLifeForm;
