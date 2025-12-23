import React from 'react';
import { type HealthAccidentCriticalIllnessProduct, type ValueAddedServiceItem } from '../../types';
import Input from '../ui/Input';
import ValueAddedServiceEditor from './ValueAddedServiceEditor';

interface FormProps {
  product: HealthAccidentCriticalIllnessProduct;
  onFormChange: (field: keyof HealthAccidentCriticalIllnessProduct, value: any) => void;
}

const HealthAccidentForm: React.FC<FormProps> = ({ product, onFormChange }) => {
    
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? parseFloat(value) || 0 : value;
    onFormChange(name as keyof HealthAccidentCriticalIllnessProduct, finalValue);
  };

  const handleServicesChange = (items: ValueAddedServiceItem[]) => {
    onFormChange('valueAddedServices', items);
  };
    
  return (
    <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="保障区域" id="coverageArea" name="coverageArea" value={product.coverageArea} onChange={handleChange} required />
            <Input label="医院范围" id="hospitalScope" name="hospitalScope" value={product.hospitalScope} onChange={handleChange} required />
            <Input label="赔付范围" id="claimScope" name="claimScope" value={product.claimScope} onChange={handleChange} required />
            <Input label="职业范围" id="occupationScope" name="occupationScope" value={product.occupationScope} onChange={handleChange} required />
            <Input label="犹豫期" id="hesitationPeriod" name="hesitationPeriod" value={product.hesitationPeriod} onChange={handleChange} required />
            <Input label="保单生效日" id="policyEffectiveDate" name="policyEffectiveDate" value={product.policyEffectiveDate} onChange={handleChange} required />
            <Input label="购买份数" id="purchaseLimit" name="purchaseLimit" type="number" value={product.purchaseLimit} onChange={handleChange} required />
            <Input label="年保费" id="annualPremium" name="annualPremium" type="number" value={product.annualPremium} onChange={handleChange} required />
        </div>
        <div className="pt-4 border-t border-gray-200">
            <ValueAddedServiceEditor items={product.valueAddedServices || []} onChange={handleServicesChange} />
        </div>
    </div>
  );
};

export default HealthAccidentForm;
