import React, { useRef } from 'react';
import { type InsuranceProduct, PrimaryCategory, ProductStatus } from '../../types';
import GeneralInfoForm from './GeneralInfoForm';
import HealthAccidentForm from './HealthAccidentForm';
import CriticalIllnessForm from './CriticalIllnessForm';
import TermLifeForm from './TermLifeForm';
import WholeLifeForm from './WholeLifeForm';
import AnnuityForm from './AnnuityForm';

interface ProductFormProps {
  product: InsuranceProduct;
  onFormChange: (field: keyof InsuranceProduct, value: any) => void;
  onActivate: () => void;
  allowedResponsibilities?: { code: string; name: string }[];
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onFormChange, onActivate, allowedResponsibilities }) => {
  const formRef = useRef<HTMLFormElement>(null);

  const renderSpecificForm = () => {
    switch (product.primaryCategory) {
      case PrimaryCategory.HEALTH:
      case PrimaryCategory.ACCIDENT:
        return <HealthAccidentForm product={product} onFormChange={onFormChange} allowedResponsibilities={allowedResponsibilities} />;
      case PrimaryCategory.CRITICAL_ILLNESS:
        return <CriticalIllnessForm product={product as any} onFormChange={onFormChange as any} />;
      case PrimaryCategory.TERM_LIFE:
        return <TermLifeForm product={product} onFormChange={onFormChange} />;
      case PrimaryCategory.WHOLE_LIFE:
        return <WholeLifeForm product={product} onFormChange={onFormChange} />;
      case PrimaryCategory.ANNUITY:
        return <AnnuityForm product={product} onFormChange={onFormChange} />;
      default:
        return null;
    }
  };

  const handleActivate = (e: React.MouseEvent) => {
      e.preventDefault();
      if (formRef.current && formRef.current.reportValidity()) {
          onActivate();
      }
  };

  return (
    <form ref={formRef} className="space-y-8">
      <GeneralInfoForm product={product} onFormChange={onFormChange} />
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {product.primaryCategory} 专属信息
        </h3>
        {renderSpecificForm()}
      </div>
      <div className="flex justify-end pt-4 space-x-4">
        <button 
            type="button"
            onClick={handleActivate}
            className="px-6 py-2 bg-brand-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition"
        >
            上线生效
        </button>
      </div>
    </form>
  );
};

export default ProductForm;
