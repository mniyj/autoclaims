import React from 'react'

type PayoutType = 'SINGLE' | 'MULTIPLE_GROUPED' | 'MULTIPLE_UNGROUPED'

const ITEM_CODE_OPTIONS = [
  { code: 'CRITICAL_ILLNESS', name: '重大疾病保险金' },
  { code: 'MODERATE_ILLNESS', name: '中症保险金' },
  { code: 'MILD_ILLNESS', name: '轻症保险金' },
  { code: 'CRITICAL_ILLNESS_EXTRA', name: '重大疾病额外赔付' },
  { code: 'MALIGNANT_TUMOR_MULTIPLE', name: '恶性肿瘤多次赔付' },
  { code: 'CARDIOVASCULAR_DISEASE_MULTIPLE', name: '心脑血管多次赔付' },
  { code: 'CHILD_SPECIFIC_ILLNESS', name: '少儿特定疾病' },
  { code: 'DEATH_OR_TOTAL_DISABILITY', name: '身故或全残保险金' },
  { code: 'INSURED_PREMIUM_WAIVER', name: '被保险人保费豁免' },
  { code: 'POLICYHOLDER_PREMIUM_WAIVER', name: '投保人保费豁免' },
  { code: 'OTHERS', name: '其他责任' },
]

interface GroupItem {
  group_name: string
  disease_list: string[]
}

interface CoverageDetail {
  mandatory?: boolean
  item_code: string
  item_name: string
  description: string
  details: {
    illness_count?: number
    payout_type?: PayoutType
    max_payouts?: number
    payouts?: number
    payout_ratio?: number
    payout_ratios?: number[]
    interval_days?: number
    interval_years?: number
    group_details?: {
      group_count: number
      groups: GroupItem[]
    }
    age_limit_before?: number
    extra_payout_ratio?: number
    condition?: string
    payout_logic?: string
    trigger_events?: string[]
  }
}

const numberOrZero = (v: any) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? 0 : n
}

const parseList = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean)

const CriticalIllnessCoverageEditor: React.FC<{
  items: CoverageDetail[]
  onChange: (items: CoverageDetail[]) => void
}> = ({ items, onChange }) => {
  const addItem = () => {
    const next = [...(items || [])]
    next.push({
      item_code: '',
      item_name: '',
      description: '',
      details: {}
    })
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

  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx)
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-gray-800">保障责任（重疾险）</h4>
        <button type="button" onClick={addItem} className="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded hover:bg-black">新增责任</button>
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
                <option value="">请选择重疾责任类型，如重大疾病/轻症</option>
                {ITEM_CODE_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">责任名称 *</label>
              <input value={it.item_name} onChange={e => updateItem(idx, { item_name: e.target.value })} placeholder="例如：重大疾病保险金/轻症保险金" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
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
              <input value={it.description || ''} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="简要描述，如：确诊即赔/满足等待期后给付" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">赔付类型</label>
              <select value={it.details?.payout_type || ''} onChange={e => updateDetails(idx, { payout_type: e.target.value as PayoutType })} className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md bg-white">
                <option value="">请选择单次/多次赔付（是否分组）</option>
                <option value="SINGLE">单次赔付</option>
                <option value="MULTIPLE_GROUPED">多次（分组）</option>
                <option value="MULTIPLE_UNGROUPED">多次（不分组）</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最多赔付次数</label>
              <input type="number" value={it.details?.max_payouts ?? 0} onChange={e => updateDetails(idx, { max_payouts: numberOrZero(e.target.value) })} placeholder="例如：2" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">单次赔付比例</label>
              <input type="number" step="0.01" value={it.details?.payout_ratio ?? 0} onChange={e => updateDetails(idx, { payout_ratio: parseFloat(e.target.value) || 0 })} placeholder="比例小数，如1=100%，0.3=30%" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">多次赔付比例(逗号分隔)</label>
              <input value={(it.details?.payout_ratios || []).join(',')} onChange={e => updateDetails(idx, { payout_ratios: parseList(e.target.value).map(x => parseFloat(x) || 0) })} placeholder="例如：1,0.5,0.3（代表100%/50%/30%）" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">间隔期(年)</label>
              <input type="number" value={it.details?.interval_years ?? 0} onChange={e => updateDetails(idx, { interval_years: numberOrZero(e.target.value) })} placeholder="多次赔付的间隔年限，如1或2" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">疾病种类数</label>
              <input type="number" value={it.details?.illness_count ?? 0} onChange={e => updateDetails(idx, { illness_count: numberOrZero(e.target.value) })} placeholder="覆盖的疾病数，如：120" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          {(it.details?.payout_type === 'MULTIPLE_GROUPED') && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">疾病分组</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分组数量</label>
                  <input type="number" value={it.details?.group_details?.group_count ?? 0} onChange={e => updateDetails(idx, { group_details: { group_count: numberOrZero(e.target.value), groups: it.details?.group_details?.groups || [] } })} placeholder="如：3" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
                </div>
              </div>
              <div className="space-y-2">
                {(it.details?.group_details?.groups || []).map((g, gi) => (
                  <div key={gi} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">分组名称</label>
                      <input value={g.group_name} onChange={e => {
                        const groups = [...(it.details?.group_details?.groups || [])]
                        groups[gi] = { ...groups[gi], group_name: e.target.value }
                        updateDetails(idx, { group_details: { group_count: it.details?.group_details?.group_count || groups.length, groups } })
                      }} placeholder="如：恶性肿瘤组/心脑血管组" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">疾病列表(逗号分隔)</label>
                      <input value={(g.disease_list || []).join(',')} onChange={e => {
                        const groups = [...(it.details?.group_details?.groups || [])]
                        groups[gi] = { ...groups[gi], disease_list: parseList(e.target.value) }
                        updateDetails(idx, { group_details: { group_count: it.details?.group_details?.group_count || groups.length, groups } })
                      }} placeholder="如：恶性肿瘤、急性心肌梗死、脑中风后遗症" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => {
                  const groups = [...(it.details?.group_details?.groups || [])]
                  groups.push({ group_name: '', disease_list: [] })
                  updateDetails(idx, { group_details: { group_count: (it.details?.group_details?.group_count || 0) + 1, groups } })
                }} className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded">新增分组</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">额外赔付年龄上限</label>
              <input type="number" value={it.details?.age_limit_before ?? 0} onChange={e => updateDetails(idx, { age_limit_before: numberOrZero(e.target.value) })} placeholder="如：18（≤18岁额外赔付）" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">额外赔付比例</label>
              <input type="number" step="0.01" value={it.details?.extra_payout_ratio ?? 0} onChange={e => updateDetails(idx, { extra_payout_ratio: parseFloat(e.target.value) || 0 })} placeholder="比例小数，如0.5=50%" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">触发条件</label>
              <input value={it.details?.condition || ''} onChange={e => updateDetails(idx, { condition: e.target.value })} placeholder="如：≤18岁/首次确诊/特定疾病" className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">赔付逻辑(身故/全残)</label>
              <textarea value={it.details?.payout_logic || ''} onChange={e => updateDetails(idx, { payout_logic: e.target.value })} placeholder="如：身故返还已交保费与现金价值的较大者" className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">豁免触发事件(逗号分隔)</label>
              <textarea value={(it.details?.trigger_events || []).join(',')} onChange={e => updateDetails(idx, { trigger_events: parseList(e.target.value) })} placeholder="如：确诊轻症、中症、重疾/意外全残" className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => removeItem(idx)} className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded hover:bg-red-50">删除责任</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default CriticalIllnessCoverageEditor
