import React from 'react'
import Input from '../ui/Input'
import CriticalIllnessCoverageEditor from './CriticalIllnessCoverageEditor'

interface CIPlan {
  planType: string
  coverageDetails: any[]
}

const CriticalIllnessPlansEditor: React.FC<{
  plans: CIPlan[]
  onChange: (plans: CIPlan[]) => void
}> = ({ plans, onChange }) => {
  const addPlan = () => {
    onChange([...(plans || []), { planType: '', coverageDetails: [] }])
  }
  const removePlan = (index: number) => {
    const next = (plans || []).filter((_, i) => i !== index)
    onChange(next)
  }
  const updatePlan = (index: number, patch: Partial<CIPlan>) => {
    const next = [...(plans || [])]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">保障方案</h3>
        <button type="button" onClick={addPlan} className="px-3 py-1.5 text-sm font-semibold bg-brand-blue-600 text-white rounded hover:bg-brand-blue-700">新增方案</button>
      </div>
      {(plans || []).map((plan, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="方案名称" id={`ci-plan-${idx}`} name={`ci-plan-${idx}`} value={plan.planType || ''} onChange={e => updatePlan(idx, { planType: e.target.value })} placeholder="例如：经典版/尊享版/少儿特护版" required />
          </div>
          <CriticalIllnessCoverageEditor items={plan.coverageDetails || []} onChange={(items) => updatePlan(idx, { coverageDetails: items })} />
          <div className="flex justify-end">
            <button type="button" onClick={() => removePlan(idx)} className="px-3 py-1.5 text-sm font-semibold text-red-600 border border-red-200 rounded hover:bg-red-50">删除方案</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default CriticalIllnessPlansEditor
