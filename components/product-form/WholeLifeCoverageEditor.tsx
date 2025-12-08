import React from 'react'

interface CoverageDetailItem {
  item_code: string
  item_name: string
  description: string
  mandatory?: boolean
  details: { payout_logic: string }
}

const WholeLifeCoverageEditor: React.FC<{ items: CoverageDetailItem[]; onChange: (items: CoverageDetailItem[]) => void }> = ({ items, onChange }) => {
  const addItem = () => {
    const next = [...(items || [])]
    next.push({ item_code: 'DEATH_OR_TOTAL_DISABILITY', item_name: '', description: '', details: { payout_logic: '' } })
    onChange(next)
  }
  const removeItem = (idx: number) => onChange((items || []).filter((_, i) => i !== idx))
  const updateItem = (idx: number, patch: Partial<CoverageDetailItem>) => {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }
  const updateDetails = (idx: number, patch: Partial<CoverageDetailItem['details']>) => {
    const next = [...items]
    next[idx] = { ...next[idx], details: { ...(next[idx].details || {}), ...patch } }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify_between items-center">
        <h4 className="text-sm font-semibold text-gray-800">保障责任（终身寿）</h4>
        <button type="button" onClick={addItem} className="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded">新增责任</button>
      </div>
      {(items || []).map((it, idx) => (
        <div key={idx} className="border border-gray-200 rounded p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">责任编码</label>
              <input value={it.item_code} readOnly className="w-full h-9 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">责任名称 *</label>
              <input value={it.item_name} onChange={e => updateItem(idx, { item_name: e.target.value })} placeholder="例如：身故或全残保险金" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">是否必选</label>
              <select value={it.mandatory ? 'MANDATORY' : 'OPTIONAL'} onChange={e => updateItem(idx, { mandatory: e.target.value === 'MANDATORY' })} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white">
                <option value="MANDATORY">必选</option>
                <option value="OPTIONAL">可选</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">说明</label>
              <input value={it.description || ''} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="简要描述，如：三者取大" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">赔付逻辑</label>
            <textarea value={it.details?.payout_logic || ''} onChange={e => updateDetails(idx, { payout_logic: e.target.value })} placeholder="如：已交保费×系数、现金价值、年度有效保额三者取大" className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => removeItem(idx)} className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded">删除责任</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default WholeLifeCoverageEditor
