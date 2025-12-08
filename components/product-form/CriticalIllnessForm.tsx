import React from 'react'
import { type HealthAccidentCriticalIllnessProduct } from '../../types'
import Input from '../ui/Input'
import ValueAddedServiceEditor from './ValueAddedServiceEditor'
import CriticalIllnessPlansEditor from './CriticalIllnessPlansEditor'

interface FormProps {
  product: HealthAccidentCriticalIllnessProduct
  onFormChange: (field: keyof HealthAccidentCriticalIllnessProduct, value: any) => void
}

const CriticalIllnessForm: React.FC<FormProps> = ({ product, onFormChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    const finalValue = type === 'number' ? parseFloat(value) || 0 : value
    onFormChange(name as keyof HealthAccidentCriticalIllnessProduct, finalValue)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="保障区域" id="coverageArea" name="coverageArea" value={product.coverageArea} onChange={handleChange} required />
        <Input label="职业范围" id="occupationScope" name="occupationScope" value={product.occupationScope} onChange={handleChange} required />
        <Input label="健康告知" id="healthConditionNotice" name="healthConditionNotice" value={(product as any).healthConditionNotice || ''} onChange={handleChange} />
        <Input label="年保费(起)" id="annualPremium" name="annualPremium" type="number" value={product.annualPremium} onChange={handleChange} required />
      </div>

      <div className="pt-4 border-t border-gray-200">
        <ValueAddedServiceEditor items={product.valueAddedServices || []} onChange={(items) => onFormChange('valueAddedServices', items)} />
      </div>

      <div className="pt-4 border-t border-gray-200">
        <CriticalIllnessPlansEditor plans={(product as any).coveragePlans || []} onChange={(plans) => onFormChange('coveragePlans', plans)} />
      </div>
    </div>
  )
}

export default CriticalIllnessForm
