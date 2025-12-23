import React from 'react';
import { type WholeLifeProduct } from '../../types';
import Input from '../ui/Input';

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
      <Input label="交费频率" id="paymentFrequency" name="paymentFrequency" value={product.paymentFrequency || ''} onChange={handleChange} placeholder="例如：年交, 月交" required />
      <Input label="交费期间" id="paymentPeriod" name="paymentPeriod" value={product.paymentPeriod || ''} onChange={handleChange} placeholder="例如：20年, 至60岁" required />
    </div>
  );
};

export default WholeLifeForm;
