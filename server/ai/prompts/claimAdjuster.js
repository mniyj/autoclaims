/**
 * 理赔审核员角色 Prompt
 * 用于 AI Agent 执行智能理赔审核
 */

export const CLAIM_ADJUSTER_SYSTEM_PROMPT = `你是一位资深的保险理赔审核员，具有丰富的医疗险和意外险理赔经验。

## 你的职责
1. 审核理赔案件是否符合保单责任
2. 计算应赔付金额
3. 识别潜在风险和欺诈
4. 给出专业的审核意见

## 审核流程
1. **责任判断**：首先使用 check_eligibility 工具判断案件是否符合保单责任
2. **金额计算**：如果责任成立，使用 calculate_claim_amount 工具计算赔付金额
3. **辅助核查**：根据需要查询医保目录(query_medical_catalog)和医院信息(query_hospital_info)
4. **综合结论**：基于工具返回结果，给出审核结论和理由

## 输出格式
请按以下结构输出审核结论：

### 审核结论
- **决定**: [APPROVE/REJECT/MANUAL_REVIEW]
- **理赔金额**: ¥xxx（如适用）

### 责任判断
[说明是否符合保单责任，引用具体条款]

### 金额计算（如适用）
- 申请金额: ¥xxx
- 免赔额: ¥xxx
- 赔付比例: xx%
- 最终金额: ¥xxx

### 风险提示（如有）
[列出需要关注的风险点]

### 审核依据
[列出匹配的规则和条款]

## 注意事项
- 必须使用工具获取数据，不要凭空假设
- 对于无法确定的情况，建议转人工复核
- 拒赔时必须引用具体的条款依据
- 使用中文输出`;

export const CLAIM_ADJUSTER_HUMAN_PROMPT = `请审核以下理赔案件：

## 案件信息
- 产品代码: {productCode}
- 案件ID: {claimCaseId}

## OCR 提取的材料信息
{ocrDataSummary}

## 费用明细
{invoiceItemsSummary}

请使用工具进行责任判断和金额计算，然后给出审核结论。`;

/**
 * 格式化 OCR 数据摘要
 * @param {object} ocrData - OCR 数据
 * @returns {string} 格式化后的摘要
 */
export function formatOcrDataSummary(ocrData) {
  if (!ocrData || Object.keys(ocrData).length === 0) {
    return '无 OCR 数据';
  }
  
  const lines = [];
  
  if (ocrData.basicInfo) {
    const info = ocrData.basicInfo;
    lines.push(`- 患者姓名: ${info.name || '未知'}`);
    lines.push(`- 入院日期: ${info.admissionDate || '未知'}`);
    lines.push(`- 出院日期: ${info.dischargeDate || '未知'}`);
    lines.push(`- 诊断: ${info.dischargeDiagnosis || '未知'}`);
    lines.push(`- 科室: ${info.department || '未知'}`);
  }
  
  if (ocrData.invoiceInfo) {
    const info = ocrData.invoiceInfo;
    lines.push(`- 医院: ${info.hospitalName || '未知'}`);
    lines.push(`- 开票日期: ${info.issueDate || '未知'}`);
  }
  
  if (ocrData.totalAmount) {
    lines.push(`- 总金额: ¥${ocrData.totalAmount}`);
  }
  
  if (ocrData.insurancePayment) {
    const payment = ocrData.insurancePayment;
    if (payment.governmentFundPayment) {
      lines.push(`- 医保支付: ¥${payment.governmentFundPayment}`);
    }
    if (payment.personalPayment) {
      lines.push(`- 个人支付: ¥${payment.personalPayment}`);
    }
  }
  
  return lines.length > 0 ? lines.join('\n') : '无 OCR 数据';
}

/**
 * 格式化费用明细摘要
 * @param {object[]} items - 费用明细
 * @returns {string} 格式化后的摘要
 */
export function formatInvoiceItemsSummary(items) {
  if (!items || items.length === 0) {
    return '无费用明细';
  }
  
  const lines = items.map((item, idx) => {
    const name = item.itemName || item.name || `项目${idx + 1}`;
    const amount = item.totalPrice || item.amount || 0;
    const category = item.category || '';
    return `- ${name}${category ? ` (${category})` : ''}: ¥${amount}`;
  });
  
  const total = items.reduce((sum, item) => sum + (item.totalPrice || item.amount || 0), 0);
  lines.push(`\n合计: ¥${total}`);
  
  return lines.join('\n');
}
