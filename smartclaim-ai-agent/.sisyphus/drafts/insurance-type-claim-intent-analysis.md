# 不同险种下理赔意图处理差异分析报告

## 一、执行摘要

本文档分析了 `smartclaim-ai-agent` 项目中不同险种（医疗险、车险、意外险）在理赔意图处理上的差异，识别出现有实现中的关键问题，并提出针对性的改进方案。

**核心发现**：
- 当前实现存在险种差异化处理不足的问题
- 材料清单、保费影响、缺失材料等核心功能缺乏险种特异性逻辑
- 无赔案场景下已提供较好的险种差异化体验，但有赔案场景下险种差异被忽略

---

## 二、当前险种差异处理现状

### 2.1 险种类型定义

**主要险种类型**（定义在 `/types.ts:7-15`）：
```typescript
export enum PrimaryCategory {
  HEALTH = "医疗保险",
  ACCIDENT = "意外保险",
  CRITICAL_ILLNESS = "重大疾病保险",
  TERM_LIFE = "定期寿险",
  WHOLE_LIFE = "终身寿险",
  ANNUITY = "年金保险",
  CAR_INSURANCE = "车险",
}
```

**实际使用中的险种字符串**（存在于 mock 数据中）：
- `医疗理赔`、`少儿住院医疗`、`重疾医疗理赔`
- `车辆理赔`
- `意外伤害理赔`
- `财产理赔`
- `旅行意外理赔`

> ⚠️ **问题**：险种类型缺乏统一标准，字符串值与枚举值不一致。

---

### 2.2 已实现的险种差异化处理

#### ✅ **材料清单查询** (`handleQueryMaterialsList`)

**无赔案场景**（已实现良好差异化）：
```typescript
// intentTools.ts:280
if (claimType && ['医疗险', '车险', '意外险'].includes(claimType)) {
  const materials = getGenericMaterialsByType(claimType);
  // 返回险种特定材料
}

// 未指定险种，展示所有险种示例
return {
  message: `🏥 **医疗险**（看病报销）：...
🚗 **车险**（车辆事故）：...
🛡️ **意外险**（意外伤害）：...`
};
```

**材料定义**（`getGenericMaterialsByType`，`intentTools.ts:2374-2413`）：
| 险种 | 必需材料 | 补充材料 |
|------|----------|----------|
| 医疗险 | 身份证、医疗发票、病历资料、费用清单、银行卡 | 出院小结 |
| 车险 | 身份证、驾驶证、行驶证、事故认定书、维修发票 | 现场照片 |
| 意外险 | 身份证、事故证明、银行卡 | 医疗材料、伤残鉴定 |

**有赔案场景**：仅使用 `targetClaim.type` 获取材料，**无险种特异性逻辑**。

---

#### ✅ **保费影响查询** (`handleQueryPremiumImpact`)

**无赔案场景**（已实现差异化）：
```typescript
// intentTools.ts:556-577
if (policyType) {
  const impactInfo = calculatePremiumImpact(policyType, 0);
  // 车险：NCD系数变化、保费上涨百分比
  // 医疗险/意外险：一般不影响保费
}

// 通用说明
message: `🚗 **车险**：影响NCD无赔款优待系数
🏥 **医疗险/意外险**：通常不影响保费`
```

---

### 2.3 未实现险种差异化处理的功能

#### ❌ **缺失材料查询** (`handleQueryMissingMaterials`)

当前实现：
```typescript
// intentTools.ts:395-462
async function handleQueryMissingMaterials(...) {
  // 无论险种，统一使用相同的缺失材料检测逻辑
  const targetClaim = findTargetClaim(...);
  const missingMaterials = detectMissingMaterials(targetClaim.documents);
  // 无险种特异性处理
}
```

**问题**：
- 不同险种对"缺失材料"的定义不同
- 医疗险需要住院小结、诊断证明
- 车险需要事故认定书、驾驶证
- 当前逻辑未区分这些差异

---

#### ❌ **赔付金额查询** (`handleQuerySettlementAmount`)

当前实现：
```typescript
// intentTools.ts:1141-1227
function handleQuerySettlementAmount(...) {
  // 直接返回 claim.amount
  // 无险种特异性计算逻辑
}
```

**应实现的差异化**：
| 险种 | 赔付计算逻辑 |
|------|--------------|
| 医疗险 | 发票金额 × 赔付比例 - 免赔额 |
| 车险 | 定损金额 - 绝对免赔额 |
| 意外险 | 伤残等级 × 保额 |

---

#### ❌ **赔付明细查询** (`handleQuerySettlementDetail`)

当前实现：
```typescript
// intentTools.ts:1232-1378
function handleQuerySettlementDetail(...) {
  // 通用明细展示
  // 无险种特定字段
}
```

**应展示的险种特定信息**：
- **医疗险**：分项赔付（床位费、药品费、手术费）、自付比例
- **车险**：维修项目明细、残值扣除
- **意外险**：伤残等级、一次性赔付/分期赔付说明

---

#### ❌ **打款状态查询** (`handleQueryPaymentStatus`)

当前实现：
```typescript
// intentTools.ts:1440-1524
function handleQueryPaymentStatus(...) {
  // 通用状态展示
}
```

**问题**：不同险种的打款时效不同，应提供险种特定的时效说明。

---

## 三、问题汇总与影响分析

### 3.1 关键问题

| 问题 | 严重性 | 影响 |
|------|--------|------|
| 1. 险种类型字符串不统一 | 高 | 导致 `claim.type` 匹配失败，无法正确获取险种特定材料 |
| 2. 有赔案场景下险种差异被忽略 | 高 | 用户获得的是通用信息，而非针对其案件类型的个性化指导 |
| 3. 缺失材料检测无险种逻辑 | 中 | 可能提示错误的材料需求，或遗漏必需材料 |
| 4. 赔付计算无险种公式 | 中 | 用户无法预估准确的赔付金额 |
| 5. 材料上传无险种校验 | 中 | 无法针对不同险种提供正确的材料上传指导 |

### 3.2 具体示例

**场景**：用户有 2 个赔案（医疗险 + 车险），询问"还缺什么材料"

**当前行为**：
1. 系统展示案件选择列表
2. 用户选择医疗险案件
3. 系统使用通用逻辑检测缺失材料
4. 可能错误地提示需要"驾驶证"（这是车险材料）

**期望行为**：
1. 系统展示案件选择列表
2. 用户选择医疗险案件
3. 系统根据**医疗险材料清单**检测缺失
4. 准确提示缺少"出院小结"、"诊断证明"

---

## 四、改进方案（基于现有计划扩展）

### 4.1 建议的架构调整

```
intentTools.ts
├── resolveTargetClaim() - 案件选择解析
├── getGenericMaterialsByType() - ✅ 已存在，需扩展
├── detectMissingMaterialsByType() - 🆕 新增：险种特异性缺失检测
├── calculateSettlementByType() - 🆕 新增：险种特异性赔付计算
└── getTypeSpecificGuidance() - 🆕 新增：险种特异性指导信息
```

### 4.2 任务扩展示意图

基于现有 `intentTools-refactor.md` 计划，建议增加以下任务：

#### **Task 8: 扩展材料差异处理逻辑**（新增）

**What to do**:
- 扩展 `getGenericMaterialsByType` 支持更多险种
- 创建 `normalizeClaimType()` 函数统一险种类型字符串
- 添加险种别名映射（如"医疗理赔"→"医疗险"）

**Implementation**:
```typescript
// 险种类型标准化映射
const CLAIM_TYPE_ALIASES: Record<string, string> = {
  '医疗理赔': '医疗险',
  '少儿住院医疗': '医疗险',
  '重疾医疗理赔': '医疗险',
  '车辆理赔': '车险',
  '意外伤害理赔': '意外险',
  '财产理赔': '家财险',
  '旅行意外理赔': '旅行险'
};

function normalizeClaimType(type: string): string {
  return CLAIM_TYPE_ALIASES[type] || type;
}
```

---

#### **Task 9: 添加险种特异性缺失材料检测**（新增）

**What to do**:
- 创建 `detectMissingMaterialsByType()` 函数
- 根据险种类型使用不同的材料清单模板
- 在 `handleQueryMissingMaterials` 中调用

**Implementation**:
```typescript
function detectMissingMaterialsByType(
  claim: HistoricalClaim,
  claimType: string
): MaterialItem[] {
  const normalizedType = normalizeClaimType(claimType);
  const requiredMaterials = getGenericMaterialsByType(normalizedType);
  
  const uploadedDocs = claim.documents || [];
  return requiredMaterials.filter(material => {
    const isUploaded = uploadedDocs.some(doc => 
      doc.category?.includes(material.name) || 
      doc.name?.includes(material.name)
    );
    return material.required && !isUploaded;
  });
}
```

---

#### **Task 10: 添加险种特异性赔付计算**（新增）

**What to do**:
- 创建 `calculateSettlementByType()` 函数
- 医疗险：支持分项计算（药品费、检查费、手术费）
- 车险：支持定损明细展示
- 意外险：支持伤残等级对应赔付

**Implementation**:
```typescript
interface SettlementCalculation {
  totalAmount: number;
  breakdown: { category: string; amount: number; deductible: number }[];
  explanation: string;
}

function calculateSettlementByType(
  claim: HistoricalClaim,
  claimType: string
): SettlementCalculation {
  const normalizedType = normalizeClaimType(claimType);
  
  switch (normalizedType) {
    case '医疗险':
      return calculateMedicalSettlement(claim);
    case '车险':
      return calculateAutoSettlement(claim);
    case '意外险':
      return calculateAccidentSettlement(claim);
    default:
      return { totalAmount: claim.amount || 0, breakdown: [], explanation: '' };
  }
}
```

---

#### **Task 11: 统一险种类型处理**（新增）

**What to do**:
- 在所有使用 `claim.type` 的地方调用 `normalizeClaimType()`
- 更新 `handleQueryMaterialsList`、`handleQueryMissingMaterials` 等函数
- 确保险种别名映射覆盖所有 mock 数据中的类型值

**Files to modify**:
- `intentTools.ts` - 多处需要更新

---

## 五、优先级与实施建议

### 5.1 实施优先级

**P0（立即）**：
1. Task 1-2：基础案件选择设施 + 材料查询重构（已有计划）
2. Task 11：统一险种类型处理（新增）

**P1（高优先级）**：
3. Task 8：扩展材料差异处理
4. Task 9：险种特异性缺失材料检测
5. Task 3：缺失材料查询重构（已有计划）

**P2（中优先级）**：
6. Task 10：险种特异性赔付计算
7. Task 4-5：查询类和操作类函数重构（已有计划）

**P3（低优先级）**：
8. Task 6-7：意图重触发 + 集成测试（已有计划）

### 5.2 数据一致性建议

建议统一 mock 数据中的险种类型值，与 `PrimaryCategory` 枚举保持一致：

```typescript
// constants.ts 更新建议
export const MOCK_HISTORICAL_CLAIMS: HistoricalClaim[] = [
  {
    id: "CLM-2024-001",
    type: "车险",  // 从"车辆理赔"改为"车险"
    // ...
  },
  {
    id: "CLM-2024-002",
    type: "医疗险",  // 从"医疗理赔"改为"医疗险"
    // ...
  }
];
```

---

## 六、总结

### 6.1 现状总结

| 功能模块 | 无赔案场景 | 有赔案场景 |
|----------|------------|------------|
| 材料清单查询 | ✅ 良好差异化 | ⚠️ 仅使用 claim.type，无险种特异性 |
| 保费影响查询 | ✅ 良好差异化 | ⚠️ 通用处理 |
| 缺失材料查询 | ✅ 友好提示 | ❌ 无险种特异性检测 |
| 赔付金额查询 | ✅ 通用说明 | ❌ 无险种特异性计算 |
| 赔付明细查询 | ✅ 通用说明 | ❌ 无险种特定字段 |

### 6.2 关键行动项

1. **立即修复**：实施现有计划中的 Task 1-3，解决多赔案选择问题
2. **短期优化**：添加 Task 8-11，实现险种类型标准化和特异性处理
3. **长期改进**：根据实际业务需求，扩展更多险种的差异化逻辑

### 6.3 预期效果

实施后，用户在多险种场景下将获得：
- **准确的材料清单**：根据案件类型显示正确的材料要求
- **精准的缺失检测**：不再提示无关材料，不再遗漏必需材料
- **合理的赔付预估**：基于险种公式的初步金额估算
- **个性化的指导信息**：针对不同险种的理赔特点提供专业建议

---

*分析报告生成时间：2026-03-04*  
*基于代码版本：smartclaim-ai-agent/intentTools.ts (2685 lines)*
