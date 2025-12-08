import React from 'react'

const ITEM_CODE_OPTIONS = [
  { code: 'ANNUITY_PAYMENT', name: '年金给付' },
  { code: 'SURVIVAL_BENEFIT', name: '生存金' },
  { code: 'MATURITY_BENEFIT', name: '满期金' },
  { code: 'DEATH_BENEFIT', name: '身故保险金' }
]

interface CoverageDetail {
  item_code: string
  item_name: string
  description: string
  mandatory?: boolean
  details: {
    start_age_options?: number[]
    frequency_options?: ('ANNUALLY'|'MONTHLY')[]
    guaranteed_period_years?: number
    amount_logic?: string
    payout_logic?: string
  }
}

const parseNumberList = (v: string) => v.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))

const AnnuityCoverageEditor: React.FC<{
  items: CoverageDetail[]
  onChange: (items: CoverageDetail[]) => void
}> = ({ items, onChange }) => {
  const addItem = () => {
    onChange([...(items || []), { item_code: '', item_name: '', description: '', details: {} }])
  }
  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
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

  const toggleFreq = (idx: number, value: 'ANNUALLY'|'MONTHLY') => {
    const cur = items[idx].details?.frequency_options || []
    const exists = cur.includes(value)
    const next = exists ? cur.filter(x => x !== value) : [...cur, value]
    updateDetails(idx, { frequency_options: next })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-gray-800">保障责任（年金险）</h4>
        <button type="button" onClick={addItem} className="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded">新增责任</button>
      </div>
      {(items || []).map((it, idx) => (
        <div key={idx} className="border border-gray-200 rounded p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">责任编码 *</label>
              <select value={it.item_code} onChange={e => {
                const code = e.target.value
                const name = ITEM_CODE_OPTIONS.find(o => o.code === code)?.name || ''
                updateItem(idx, { item_code: code, item_name: name })
              }} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white">
                <option value="">请选择年金责任类型，如年金给付/生存金</option>
                {ITEM_CODE_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">责任名称 *</label>
              <input value={it.item_name} onChange={e => updateItem(idx, { item_name: e.target.value })} placeholder="例如：年金给付/身故保险金" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
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
              <input value={it.description || ''} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="简要描述，如：自起领日每年给付" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">起领年龄(逗号分隔)</label>
              <input value={(it.details?.start_age_options || []).join(',')} onChange={e => updateDetails(idx, { start_age_options: parseNumberList(e.target.value) })} placeholder="例如：60,65,70" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">领取频率</label>
              <div className="flex items-center space-x-3 h-9">
                <label className="inline-flex items-center space-x-1 text-xs text-gray-700">
                  <input type="checkbox" checked={(it.details?.frequency_options || []).includes('ANNUALLY')} onChange={() => toggleFreq(idx, 'ANNUALLY')} />
                  <span>年领</span>
                </label>
                <label className="inline-flex items-center space-x-1 text-xs text-gray-700">
                  <input type="checkbox" checked={(it.details?.frequency_options || []).includes('MONTHLY')} onChange={() => toggleFreq(idx, 'MONTHLY')} />
                  <span>月领</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">保证领取(年)</label>
              <input type="number" value={it.details?.guaranteed_period_years ?? 0} onChange={e => updateDetails(idx, { guaranteed_period_years: parseInt(e.target.value, 10) || 0 })} placeholder="例如：20（保证领取20年）" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">金额逻辑</label>
              <textarea value={it.details?.amount_logic || ''} onChange={e => updateDetails(idx, { amount_logic: e.target.value })} placeholder="如：每年领取100%基本保额；逐年递增5%" className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">身故赔付逻辑</label>
              <textarea value={it.details?.payout_logic || ''} onChange={e => updateDetails(idx, { payout_logic: e.target.value })} placeholder="如：返还已交保费与现金价值的较大者" className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md" />
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

export default AnnuityCoverageEditor
