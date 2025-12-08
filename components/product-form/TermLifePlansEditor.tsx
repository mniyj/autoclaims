import React from 'react'
import Input from '../ui/Input'
import TermLifeCoverageEditor from './TermLifeCoverageEditor'

interface TLPlan { planType: string; coverageDetails: any[] }

const TermLifePlansEditor: React.FC<{ plans: TLPlan[]; onChange: (plans: TLPlan[]) => void }> = ({ plans, onChange }) => {
  const addPlan = () => onChange([...(plans || []), { planType: '', coverageDetails: [] }])
  const removePlan = (idx: number) => onChange((plans || []).filter((_, i) => i !== idx))
  const updatePlan = (idx: number, patch: Partial<TLPlan>) => {
    const next = [...(plans || [])]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">保障方案</h3>
        <button type="button" onClick={addPlan} className="px-3 py-1.5 text-sm font-semibold bg-brand-blue-600 text-white rounded">新增方案</button>
      </div>
      {(plans || []).map((p, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="方案名称" id={`tl-plan-${idx}`} name={`tl-plan-${idx}`} value={p.planType || ''} onChange={e => updatePlan(idx, { planType: e.target.value })} placeholder="例如：标准版/加护版" required />
          </div>
          <TermLifeCoverageEditor items={p.coverageDetails || []} onChange={(items) => updatePlan(idx, { coverageDetails: items })} />
          <div className="flex justify-end">
            <button type="button" onClick={() => removePlan(idx)} className="px-3 py-1.5 text-sm font-semibold text-red-600 border border-red-200 rounded">删除方案</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default TermLifePlansEditor
