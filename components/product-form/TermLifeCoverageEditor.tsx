import React from 'react'

const ITEM_CODE_OPTIONS = [
  { code: 'DEATH_OR_TOTAL_DISABILITY', name: '身故或全残保险金' },
  { code: 'SPECIFIC_ACCIDENT', name: '特定意外额外赔付' },
  { code: 'SUDDEN_DEATH', name: '猝死保险金' },
  { code: 'INSURED_PREMIUM_WAIVER', name: '被保险人保费豁免' },
]

interface CoverageDetail {
  item_code: string
  item_name: string
  description: string
  mandatory?: boolean
  details: {
    payout_logic?: string
    scenario?: string
    payout_multiplier?: number
    additional_limit?: number
    trigger_events?: string[]
  }
}

const numberOrZero = (v: any) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? 0 : n
}

const parseList = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean)

const TermLifeCoverageEditor: React.FC<{ items: CoverageDetail[]; onChange: (items: CoverageDetail[]) => void }> = ({ items, onChange }) => {
  const addItem = () => {
    const next = [...(items || [])]
    next.push({ item_code: '', item_name: '', description: '', mandatory: true, details: {} })
    onChange(next)
  }
  const updateItem = (idx: number, patch: Partial<CoverageDetail>) => {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }
  const updateDetails = (idx: number, patch: Partial<CoverageDetail['details']>) => {
    const next = [...items]
    next[idx] = { ...next[idx], details: { ...(next[idx].details || {}), ...patch } }
    onChange(next)
  }
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-gray-800">保障责任（定期寿险）</h4>
        <button type="button" onClick={addItem} className="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded">新增责任</button>
      </div>
      {(items || []).map((it, idx) => (
        <div key={idx} className="border border-gray-200 rounded p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">责任编码 *</label>
              <select value={it.item_code} onChange={e => {
                const code = e.target.value
                const name = ITEM_CODE_OPTIONS.find(o => o.code === code)?.name || ''
                updateItem(idx, { item_code: code, item_name: name })
              }} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white">
                <option value="">请选择责任类型，如身故或全残</option>
                {ITEM_CODE_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.code}</option>)}
              </select>
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
              <input value={it.description || ''} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="简要描述，如：赔付基本保额/豁免触发说明" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">赔付逻辑</label>
              <input value={it.details?.payout_logic || ''} onChange={e => updateDetails(idx, { payout_logic: e.target.value })} placeholder="如：赔付100%基本保额" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">场景/说明</label>
              <input value={it.details?.scenario || ''} onChange={e => updateDetails(idx, { scenario: e.target.value })} placeholder="如：法定节假日航空意外/公共交通意外" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">额外赔付倍数</label>
              <input type="number" step="0.01" value={it.details?.payout_multiplier ?? 0} onChange={e => updateDetails(idx, { payout_multiplier: parseFloat(e.target.value) || 0 })} placeholder="如：2.0" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">额外赔付限额(元)</label>
              <input type="number" value={it.details?.additional_limit ?? 0} onChange={e => updateDetails(idx, { additional_limit: numberOrZero(e.target.value) })} placeholder="如：200000" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">豁免触发事件(逗号分隔)</label>
              <input value={(it.details?.trigger_events || []).join(',')} onChange={e => updateDetails(idx, { trigger_events: parseList(e.target.value) })} placeholder="如：被保险人重疾/中症/轻症/全残" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => removeItem(idx)} className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded">删除责任</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default TermLifeCoverageEditor
