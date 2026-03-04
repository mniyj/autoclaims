# 险种差异化处理工作计划

## TL;DR

> **目标**: 解决 `smartclaim-ai-agent` 中理赔意图处理缺乏险种差异化的问题
> 
> **核心问题**: 
> - 险种类型字符串不统一（"车辆理赔" vs "车险"）
> - 有赔案场景下忽略险种差异，使用通用处理逻辑
> - 缺失材料检测、赔付计算缺乏险种特异性
>
> **交付物**:
> - 险种类型标准化系统（别名映射 + 规范化函数）
> - 扩展的材料清单差异化支持
> - 险种特异性缺失材料检测
> - 险种特异性赔付计算逻辑
> - 更新的查询类和操作类函数
>
> **预计工作量**: 中等（6个任务，可并行执行）
> **并行执行**: YES - 2个波次
> **关键路径**: Task 1 → Tasks 2-6 → Task 7

---

## Context

### 原始问题来源
基于 `intentTools-refactor.md` 计划分析发现，在处理不同险种（医疗险、车险、意外险等）的理赔意图时，系统存在以下结构性缺陷：

1. **险种类型字符串混乱**
   - Mock 数据使用: "车辆理赔", "医疗理赔", "意外伤害理赔"
   - 代码硬编码检查: ['医疗险', '车险', '意外险']
   - 结果: 类型匹配失败，无法正确识别险种

2. **有赔案场景下险种差异被忽略**
   - `handleQueryMaterialsList` 在无赔案时提供险种差异化材料
   - 但有赔案时仅使用 `targetClaim.type` 获取材料，无险种特异性处理

3. **缺失材料检测无险种逻辑**
   - 当前使用通用逻辑检测缺失材料
   - 不同险种应检测不同必需材料（医疗险需出院小结，车险需驾驶证）

4. **赔付计算缺乏险种公式**
   - 直接返回 `claim.amount`，无预估计算
   - 应提供：医疗险（分项计算）、车险（定损明细）、意外险（伤残等级×保额）

### 现有实现分析

| 功能 | 无赔案场景 | 有赔案场景 | 问题 |
|------|------------|------------|------|
| 材料清单 | ✅ 差异化良好 | ⚠️ 通用处理 | 类型匹配可能失败 |
| 保费影响 | ✅ 差异化良好 | ⚠️ 通用处理 | 信息不够个性化 |
| 缺失材料 | ✅ 友好提示 | ❌ 无险种逻辑 | 可能提示错误材料 |
| 赔付金额 | ✅ 通用说明 | ❌ 无险种公式 | 无法预估金额 |
| 赔付明细 | ✅ 通用说明 | ❌ 无特定字段 | 无法展示险种细节 |

### 研究结论
- `getGenericMaterialsByType()` (line 2374-2413) 已实现医疗险/车险/意外险材料差异化
- 需要扩展更多险种支持（家财险、旅行险、重疾险等）
- 需要建立险种类型标准化系统，统一别名映射
- 所有使用 `claim.type` 的地方都需要调用标准化函数

---

## Work Objectives

### 核心目标
建立完整的险种差异化处理体系，确保所有理赔相关意图在无赔案、单赔案、多赔案场景下都能根据险种类型提供个性化响应。

### 具体交付物
1. **险种类型标准化系统** (`CLAIM_TYPE_ALIASES` + `normalizeClaimType()`)
2. **扩展的材料清单差异化** (支持 5+ 险种)
3. **险种特异性缺失材料检测** (`detectMissingMaterialsByType()`)
4. **险种特异性赔付计算** (`calculateSettlementByType()`)
5. **更新的查询类函数** (材料查询、缺失材料、赔付查询、打款查询)
6. **更新的操作类函数** (材料上传、查看、补充等)

### 定义完成标准
- [ ] 险种类型标准化覆盖所有 mock 数据中的类型值
- [ ] 新增险种（家财险、旅行险）的材料清单定义
- [ ] 缺失材料检测根据险种使用不同的必需材料清单
- [ ] 赔付金额查询提供险种特定的预估计算和说明
- [ ] 所有修改的函数都通过 TypeScript 编译
- [ ] 向后兼容：不破坏现有单险种用户体验

### 必须包含
- 险种类型别名映射表
- 类型标准化/规范化函数
- 至少 5 个险种的材料清单（医疗险、车险、意外险、家财险、旅行险）
- 险种特异性缺失材料检测逻辑
- 险种特异性赔付计算逻辑

### 明确排除
- 不修改意图识别逻辑 (`intentService.ts` 保持原样)
- 不修改 UI 组件渲染逻辑
- 不添加后端 API 调用
- 不修改类型定义文件 (`types.ts`)
- 不修改 mock 数据结构（仅添加别名映射来兼容）

---

## Execution Strategy

### 并行执行波次

```
Wave 1 (基础设施 - 必须首先完成):
├── Task 1: 建立险种类型标准化系统 [quick]
└── Task 2: 扩展材料清单差异化 [quick]

Wave 2 (核心功能 - 依赖 Wave 1):
├── Task 3: 险种特异性缺失材料检测 [unspecified-high]
├── Task 4: 险种特异性赔付计算 [unspecified-high]
├── Task 5: 更新查询类函数 [unspecified-high]
└── Task 6: 更新操作类函数 [unspecified-high]

Wave 3 (验证 - 依赖 Wave 2):
└── Task 7: 集成测试与验证 [unspecified-high]

Critical Path: Task 1 → Tasks 2-6 → Task 7
Parallel Speedup: ~50% faster than sequential
```

### 依赖矩阵

| Task | Dependencies | Blocks |
|------|--------------|--------|
| 1 | — | 2, 3, 4, 5, 6 |
| 2 | 1 | 3, 5, 6 |
| 3 | 1, 2 | 7 |
| 4 | 1 | 5, 7 |
| 5 | 1, 2, 4 | 7 |
| 6 | 1, 2 | 7 |
| 7 | 3, 4, 5, 6 | — |

### Agent Dispatch 规划

- **Wave 1**: Task 1 → `quick`, Task 2 → `quick`
- **Wave 2**: Task 3 → `unspecified-high`, Task 4 → `unspecified-high`, Task 5 → `unspecified-high`, Task 6 → `unspecified-high`
- **Wave 3**: Task 7 → `unspecified-high` (+ `playwright` skill 如果需要浏览器测试)

---

## TODOs

### Task 1: 建立险种类型标准化系统

**What to do**:
在 `intentTools.ts` 中创建险种类型标准化基础设施：

1. **创建险种别名映射表** (`CLAIM_TYPE_ALIASES`):
   - 映射 mock 数据中的类型值到标准类型值
   - 例如: `'车辆理赔'` → `'车险'`, `'医疗理赔'` → `'医疗险'`

2. **创建标准化函数** (`normalizeClaimType()`):
   - 输入任意类型字符串
   - 返回标准化后的类型值
   - 未知类型返回原值或默认值

3. **创建险种分类函数** (可选):
   - `getInsuranceCategory(type)`: 返回大类（如所有医疗相关归为"医疗险"）

**Implementation Details**:
```typescript
// 险种类型别名映射表
const CLAIM_TYPE_ALIASES: Record<string, string> = {
  // 医疗险相关
  '医疗理赔': '医疗险',
  '少儿住院医疗': '医疗险',
  '重疾医疗理赔': '医疗险',
  '住院医疗': '医疗险',
  '门诊医疗': '医疗险',
  
  // 车险相关
  '车辆理赔': '车险',
  '机动车保险': '车险',
  '汽车保险': '车险',
  
  // 意外险相关
  '意外伤害理赔': '意外险',
  '个人意外险': '意外险',
  '团体意外险': '意外险',
  '旅行意外理赔': '旅行险',
  '全球旅行意外险': '旅行险',
  
  // 其他
  '财产理赔': '家财险',
  '家庭财产险': '家财险',
  '重大疾病理赔': '重疾险',
};

/**
 * 标准化险种类型
 * @param type 原始类型字符串
 * @returns 标准化后的类型值
 */
function normalizeClaimType(type?: string): string {
  if (!type) return '未知险种';
  return CLAIM_TYPE_ALIASES[type] || type;
}

/**
 * 检查是否为支持的险种类型
 * @param type 类型字符串
 * @returns 是否支持
 */
function isSupportedClaimType(type?: string): boolean {
  if (!type) return false;
  const normalized = normalizeClaimType(type);
  return ['医疗险', '车险', '意外险', '家财险', '旅行险', '重疾险'].includes(normalized);
}
```

**Must NOT do**:
- 不修改 `types.ts` 中的类型定义
- 不修改 mock 数据文件 (`constants.ts`)
- 不删除或修改现有函数

**References**:
- `constants.ts:369-737` - Mock 历史赔案数据，查看所有类型值
- `intentTools.ts:2374-2413` - 现有 `getGenericMaterialsByType`，了解支持的类型
- `types.ts:84-95` - `HistoricalClaim` 接口定义

**Acceptance Criteria**:
- [ ] `CLAIM_TYPE_ALIASES` 包含至少 10 个险种别名映射
- [ ] `normalizeClaimType('车辆理赔')` 返回 `'车险'`
- [ ] `normalizeClaimType('医疗理赔')` 返回 `'医疗险'`
- [ ] `isSupportedClaimType('未知险种')` 返回 `false`
- [ ] TypeScript 编译通过：`npx tsc --noEmit` 无错误

**QA Scenarios**:
```
Scenario: 标准化已知险种类型
  Tool: Bash (Node REPL)
  Steps:
    1. cd smartclaim-ai-agent && node -e "console.log(require('./intentTools.ts').normalizeClaimType('车辆理赔'))"
  Expected Result: 输出 "车险"
  Evidence: .sisyphus/evidence/task1-normalize-known.txt

Scenario: 标准化未知险种类型
  Tool: Bash (Node REPL)
  Steps:
    1. node -e "console.log(normalizeClaimType('新型险种'))"
  Expected Result: 返回 "新型险种"（原值返回）
  Evidence: .sisyphus/evidence/task1-normalize-unknown.txt
```

**Commit**: YES
- Message: `feat(intentTools): add claim type normalization system`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 2: 扩展材料清单差异化

**What to do**:
扩展 `getGenericMaterialsByType()` 函数，添加更多险种支持：

1. **扩展现有函数**:
   - 添加 `家财险` 材料清单
   - 添加 `旅行险` 材料清单
   - 添加 `重疾险` 材料清单（可选）

2. **使用标准化类型**:
   - 修改函数内部调用 `normalizeClaimType()`
   - 确保别名也能正确匹配

3. **更新 `getGenericMaterialsForNoClaims()`**:
   - 添加新险种的通用材料展示

**Implementation Details**:
```typescript
function getGenericMaterialsByType(claimType?: string): MaterialItem[] {
  // 先标准化类型
  const normalizedType = normalizeClaimType(claimType);
  
  const materialsByType: Record<string, MaterialItem[]> = {
    '医疗险': [/* 现有 */],
    '车险': [/* 现有 */],
    '意外险': [/* 现有 */],
    
    // 新增：家财险
    '家财险': [
      { id: 'home_1', name: '身份证', description: '被保险人身份证', required: true },
      { id: 'home_2', name: '房产证/租赁合同', description: '证明财产损失标的所有权', required: true },
      { id: 'home_3', name: '损失清单', description: '受损财产清单及购买凭证', required: true },
      { id: 'home_4', name: '事故证明', description: '火灾/盗窃等事故证明（消防/警方出具）', required: true },
      { id: 'home_5', name: '维修/重置报价', description: '财产维修或重置费用报价单', required: false },
      { id: 'home_6', name: '银行卡', description: '收款银行卡', required: true },
    ],
    
    // 新增：旅行险
    '旅行险': [
      { id: 'trav_1', name: '身份证/护照', description: '被保险人身份证明', required: true },
      { id: 'trav_2', name: '旅行凭证', description: '机票/酒店订单/行程单', required: true },
      { id: 'trav_3', name: '事故证明', description: '航班延误证明/医疗记录/警方报告', required: true },
      { id: 'trav_4', name: '费用凭证', description: '额外住宿/交通/医疗费用发票', required: true },
      { id: 'trav_5', name: '银行卡', description: '收款银行卡', required: true },
    ],
    
    // 新增：重疾险（简化版）
    '重疾险': [
      { id: 'crit_1', name: '身份证', description: '被保险人身份证', required: true },
      { id: 'crit_2', name: '诊断证明', description: '二级及以上医院出具的诊断证明', required: true },
      { id: 'crit_3', name: '病历资料', description: '门诊/住院病历、检查报告', required: true },
      { id: 'crit_4', name: '病理报告', description: '恶性肿瘤需提供病理检查报告', required: false },
      { id: 'crit_5', name: '银行卡', description: '收款银行卡', required: true },
    ],
  };
  
  if (normalizedType && materialsByType[normalizedType]) {
    return materialsByType[normalizedType];
  }
  
  // 未指定类型或未知类型，返回通用材料
  return [/* 通用材料 */];
}

function getGenericMaterialsForNoClaims() {
  return {
    medical: getGenericMaterialsByType('医疗险'),
    auto: getGenericMaterialsByType('车险'),
    accident: getGenericMaterialsByType('意外险'),
    home: getGenericMaterialsByType('家财险'),      // 新增
    travel: getGenericMaterialsByType('旅行险'),    // 新增
  };
}
```

**Must NOT do**:
- 不修改 `MaterialItem` 接口定义
- 不改变函数签名
- 不删除现有险种的材料定义

**References**:
- `intentTools.ts:2374-2431` - 现有 `getGenericMaterialsByType` 实现
- `constants.ts:369-737` - Mock 历史赔案，查看险种类型
- `types.ts:561-575` - `MaterialItem` 和 `MaterialsListInfo` 接口

**Acceptance Criteria**:
- [ ] `getGenericMaterialsByType('家财险')` 返回 6 项家财险材料
- [ ] `getGenericMaterialsByType('财产理赔')` 返回家财险材料（通过别名映射）
- [ ] `getGenericMaterialsByType('旅行险')` 返回 5 项旅行险材料
- [ ] 无赔案场景展示家财险和旅行险示例
- [ ] TypeScript 编译通过

**QA Scenarios**:
```
Scenario: 获取家财险材料清单
  Tool: Bash (Node REPL)
  Steps:
    1. 调用 getGenericMaterialsByType('家财险')
  Expected Result: 返回包含"房产证/租赁合同"、"损失清单"等材料
  Evidence: .sisyphus/evidence/task2-home-materials.txt

Scenario: 通过别名获取材料
  Tool: Bash (Node REPL)
  Steps:
    1. 调用 getGenericMaterialsByType('财产理赔')
  Expected Result: 返回与'家财险'相同的材料清单
  Evidence: .sisyphus/evidence/task2-alias-materials.txt
```

**Commit**: YES
- Message: `feat(intentTools): extend material lists for home and travel insurance`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 3: 险种特异性缺失材料检测

**What to do**:
创建险种特异性的缺失材料检测系统：

1. **创建 `detectMissingMaterialsByType()` 函数**:
   - 根据险种类型获取该险种的必需材料清单
   - 对比已上传的文档，找出缺失的必需材料
   - 返回缺失材料列表

2. **创建 `getRequiredMaterialsForType()` 辅助函数**:
   - 获取指定险种的必需材料（`required: true`）

3. **更新 `handleQueryMissingMaterials()`**:
   - 使用新的检测函数替换现有通用逻辑
   - 根据险种提供个性化的缺失材料提示

**Implementation Details**:
```typescript
/**
 * 获取指定险种的必需材料
 * @param claimType 险种类型
 * @returns 必需材料列表
 */
function getRequiredMaterialsForType(claimType?: string): MaterialItem[] {
  const materials = getGenericMaterialsByType(claimType);
  return materials.filter(m => m.required);
}

/**
 * 险种特异性缺失材料检测
 * @param claim 历史赔案
 * @param claimType 险种类型
 * @returns 缺失的必需材料列表
 */
function detectMissingMaterialsByType(
  claim: HistoricalClaim,
  claimType?: string
): MaterialItem[] {
  const normalizedType = normalizeClaimType(claimType || claim.type);
  const requiredMaterials = getRequiredMaterialsForType(normalizedType);
  const uploadedDocs = claim.documents || [];
  
  return requiredMaterials.filter(material => {
    // 检查是否已上传（通过名称匹配或分类匹配）
    const isUploaded = uploadedDocs.some(doc => {
      // 名称包含匹配
      const nameMatch = doc.name?.includes(material.name) || 
                       material.name?.includes(doc.name);
      // 分类匹配
      const categoryMatch = doc.category?.includes(material.name) ||
                           doc.analysis?.category?.includes(material.name);
      return nameMatch || categoryMatch;
    });
    return !isUploaded;
  });
}

/**
 * 获取险种特定的缺失材料提示信息
 * @param claimType 险种类型
 * @param missingItems 缺失材料列表
 * @returns 提示消息
 */
function getMissingMaterialsMessage(
  claimType: string, 
  missingItems: MaterialItem[]
): string {
  const normalizedType = normalizeClaimType(claimType);
  
  const typeSpecificTips: Record<string, string> = {
    '医疗险': '医疗险理赔需要提供完整的医疗记录，请确保所有就诊记录和发票齐全。',
    '车险': '车险理赔需要提供事故责任认定书，如涉及人伤还需提供医疗相关材料。',
    '意外险': '意外险理赔关键是事故证明，需要能够证明意外发生的相关材料。',
    '家财险': '家财险理赔需要提供财产损失证明和事故证明，建议拍照留存受损物品。',
    '旅行险': '旅行险理赔需要提供旅行凭证和额外费用发票，请保留所有相关票据。',
  };
  
  const tip = typeSpecificTips[normalizedType] || '请尽快补充缺失材料，以便加快理赔审核。';
  
  return `您的${normalizedType}案件还缺少以下必需材料：

${missingItems.map(m => `• **${m.name}**：${m.description}`).join('\n')}

💡 **温馨提示**：
${tip}`;
}
```

**更新 `handleQueryMissingMaterials()`**:
```typescript
async function handleQueryMissingMaterials(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const claims = claimState.historicalClaims || [];
  
  // 场景1: 无赔案
  if (claims.length === 0) {
    return {
      success: true,
      data: null,
      message: '您还没有理赔案件。如有需要，请先进行报案。',
      nextAction: { type: 'form', target: 'claim-report', label: '立即报案' }
    };
  }
  
  // 获取目标案件（处理多赔案场景）
  let targetClaim: HistoricalClaim | undefined;
  
  if (entities.claimId) {
    targetClaim = claims.find(c => c.id === entities.claimId);
    if (!targetClaim) {
      return {
        success: false,
        data: null,
        message: `未找到案件号为 "${entities.claimId}" 的案件。`,
      };
    }
  } else if (claims.length > 1) {
    return createClaimSelectionResponse(
      claims,
      IntentType.QUERY_MISSING_MATERIALS,
      "您有"
    );
  } else {
    targetClaim = claims[0];
  }
  
  // 使用险种特异性检测
  const missingItems = detectMissingMaterialsByType(targetClaim, targetClaim.type);
  
  if (missingItems.length === 0) {
    return {
      success: true,
      data: { claimId: targetClaim.id, missingItems: [] },
      message: `您的${normalizeClaimType(targetClaim.type)}案件材料已齐全，无需补充。`,
      uiComponent: UIComponentType.MISSING_MATERIALS,
      uiData: { claimId: targetClaim.id, missingItems: [], isComplete: true }
    };
  }
  
  return {
    success: true,
    data: { 
      claimId: targetClaim.id, 
      missingItems,
      urgency: 'medium'
    },
    message: getMissingMaterialsMessage(targetClaim.type, missingItems),
    uiComponent: UIComponentType.MISSING_MATERIALS,
    uiData: { 
      claimId: targetClaim.id, 
      missingItems,
      urgency: 'medium'
    }
  };
}
```

**Must NOT do**:
- 不修改 `MissingMaterialsInfo` 类型定义
- 不修改文档上传逻辑
- 不改变返回类型 `ToolResponse`

**References**:
- `intentTools.ts:395-462` - 现有 `handleQueryMissingMaterials` 实现
- `intentTools.ts:2374-2413` - `getGenericMaterialsByType` 材料定义
- `types.ts:578-583` - `MissingMaterialsInfo` 接口
- `constants.ts:369-737` - Mock 赔案数据结构

**Acceptance Criteria**:
- [ ] `detectMissingMaterialsByType` 能正确识别医疗险缺失"出院小结"
- [ ] `detectMissingMaterialsByType` 能正确识别车险缺失"驾驶证"
- [ ] 处理多赔案场景时展示案件选择 UI
- [ ] 提供险种特定的温馨提示
- [ ] TypeScript 编译通过

**QA Scenarios**:
```
Scenario: 医疗险缺失材料检测
  Tool: Bash (Node REPL)
  Preconditions: 创建模拟医疗险赔案，documents 不包含"出院小结"
  Steps:
    1. 调用 detectMissingMaterialsByType(medicalClaim, '医疗险')
  Expected Result: 返回列表包含"出院小结"（如为必需）
  Evidence: .sisyphus/evidence/task3-medical-missing.txt

Scenario: 车险缺失材料检测
  Tool: Bash (Node REPL)
  Preconditions: 创建模拟车险赔案，documents 不包含"驾驶证"
  Steps:
    1. 调用 detectMissingMaterialsByType(autoClaim, '车险')
  Expected Result: 返回列表包含"驾驶证"
  Evidence: .sisyphus/evidence/task3-auto-missing.txt
```

**Commit**: YES
- Message: `feat(intentTools): add type-specific missing materials detection`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 4: 险种特异性赔付计算

**What to do**:
创建险种特异性的赔付计算系统，为用户提供赔付金额预估：

1. **创建赔付计算接口定义**:
   - `SettlementCalculation` - 赔付计算结果
   - `SettlementBreakdownItem` - 赔付明细项

2. **创建 `calculateSettlementByType()` 函数**:
   - 医疗险：分项计算（药品费、检查费、手术费）
   - 车险：定损明细展示
   - 意外险：伤残等级 × 保额计算
   - 其他险种：通用处理

3. **创建 `getSettlementExplanation()` 函数**:
   - 根据险种生成赔付说明和建议

**Implementation Details**:
```typescript
/**
 * 赔付明细项
 */
interface SettlementBreakdownItem {
  category: string;        // 费用类别
  amount: number;          // 费用金额
  coveredAmount: number;   // 可赔付金额
  deductible: number;      // 免赔额/自付部分
  coverageRatio: number;   // 赔付比例
  note?: string;           // 说明
}

/**
 * 赔付计算结果
 */
interface SettlementCalculation {
  totalAmount: number;                    // 总费用
  totalCovered: number;                   // 总赔付金额
  breakdown: SettlementBreakdownItem[];   // 分项明细
  explanation: string;                    // 计算说明
  suggestions: string[];                  // 建议
  estimateOnly: boolean;                  // 是否仅为估算
}

/**
 * 医疗险赔付计算
 */
function calculateMedicalSettlement(claim: HistoricalClaim): SettlementCalculation {
  // 从 claim.assessment 或 documents 中提取费用信息
  const documents = claim.documents || [];
  
  // 模拟分项数据（实际应从 OCR 数据中提取）
  const breakdown: SettlementBreakdownItem[] = [
    {
      category: '药品费',
      amount: 5000,
      coveredAmount: 4000,
      deductible: 1000,
      coverageRatio: 0.8,
      note: '社保目录内药品按 80% 赔付'
    },
    {
      category: '检查费',
      amount: 2000,
      coveredAmount: 1600,
      deductible: 400,
      coverageRatio: 0.8,
      note: '合理检查费用按 80% 赔付'
    },
    {
      category: '手术费',
      amount: 15000,
      coveredAmount: 12000,
      deductible: 3000,
      coverageRatio: 0.8,
      note: '手术费用按 80% 赔付'
    }
  ];
  
  const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const totalCovered = breakdown.reduce((sum, item) => sum + item.coveredAmount, 0);
  
  return {
    totalAmount,
    totalCovered,
    breakdown,
    explanation: `医疗险赔付金额 = 总费用 × 赔付比例 - 免赔额。本案件免赔额 1000 元，赔付比例 80%。`,
    suggestions: [
      '保留所有医疗发票原件',
      '如有社保，先社保后商保',
      '注意用药是否在社保目录内'
    ],
    estimateOnly: true
  };
}

/**
 * 车险赔付计算
 */
function calculateAutoSettlement(claim: HistoricalClaim): SettlementCalculation {
  const breakdown: SettlementBreakdownItem[] = [
    {
      category: '车辆维修费',
      amount: claim.amount || 0,
      coveredAmount: (claim.amount || 0) * 0.9, // 假设 90% 赔付
      deductible: (claim.amount || 0) * 0.1,
      coverageRatio: 0.9,
      note: '根据定损报告计算'
    }
  ];
  
  return {
    totalAmount: claim.amount || 0,
    totalCovered: breakdown[0].coveredAmount,
    breakdown,
    explanation: '车险赔付根据事故责任比例和绝对免赔率计算。',
    suggestions: [
      '确认事故责任认定书',
      '了解是否有绝对免赔额',
      '维修前需保险公司定损'
    ],
    estimateOnly: true
  };
}

/**
 * 意外险赔付计算
 */
function calculateAccidentSettlement(claim: HistoricalClaim): SettlementCalculation {
  // 从 claim.assessment 中获取伤残等级
  const assessment = claim.assessment;
  const disabilityLevel = assessment?.recommendedAction?.match(/(\d+)级/)?.[1];
  
  const coverageAmount = 100000; // 假设保额 10 万
  const payoutRatio = disabilityLevel ? parseInt(disabilityLevel) / 10 : 0.1;
  const totalCovered = coverageAmount * payoutRatio;
  
  return {
    totalAmount: coverageAmount,
    totalCovered,
    breakdown: [{
      category: '伤残赔付',
      amount: coverageAmount,
      coveredAmount: totalCovered,
      deductible: coverageAmount - totalCovered,
      coverageRatio: payoutRatio,
      note: disabilityLevel ? `${disabilityLevel}级伤残，赔付比例 ${(payoutRatio * 100).toFixed(0)}%` : '待伤残鉴定'
    }],
    explanation: '意外险伤残赔付根据伤残等级确定，1级最重赔付100%，10级最轻赔付10%。',
    suggestions: [
      '需进行伤残等级鉴定',
      '保留意外事故证明',
      '治疗结束后 180 天内申请伤残鉴定'
    ],
    estimateOnly: !disabilityLevel
  };
}

/**
 * 险种特异性赔付计算
 */
function calculateSettlementByType(
  claim: HistoricalClaim,
  claimType?: string
): SettlementCalculation {
  const normalizedType = normalizeClaimType(claimType || claim.type);
  
  switch (normalizedType) {
    case '医疗险':
      return calculateMedicalSettlement(claim);
    case '车险':
      return calculateAutoSettlement(claim);
    case '意外险':
      return calculateAccidentSettlement(claim);
    default:
      // 通用处理
      return {
        totalAmount: claim.amount || 0,
        totalCovered: claim.amount || 0,
        breakdown: [{
          category: '理赔金额',
          amount: claim.amount || 0,
          coveredAmount: claim.amount || 0,
          deductible: 0,
          coverageRatio: 1,
          note: '根据案件记录'
        }],
        explanation: '具体赔付金额以保险公司核算为准。',
        suggestions: ['联系客服了解详细赔付计算'],
        estimateOnly: true
      };
  }
}
```

**更新 `handleQuerySettlementAmount()`**:
```typescript
function handleQuerySettlementAmount(
  entities: IntentEntities,
  claimState: ClaimState
): ToolResponse {
  const claims = claimState.historicalClaims || [];
  
  // 处理无赔案、多赔案场景（类似 Task 3 的模式）
  // ... 省略案件选择逻辑 ...
  
  const targetClaim = /* 获取目标案件 */;
  const calculation = calculateSettlementByType(targetClaim);
  
  const message = calculation.estimateOnly
    ? `根据您提供的${normalizeClaimType(targetClaim.type)}案件信息，初步估算赔付金额如下：

💰 **预估赔付金额：${calculation.totalCovered.toLocaleString()} 元**

📋 **费用明细**：
${calculation.breakdown.map(item => 
  `• ${item.category}：${item.amount.toLocaleString()} 元（赔付 ${item.coveredAmount.toLocaleString()} 元）`
).join('\n')}

${calculation.explanation}

💡 **建议**：
${calculation.suggestions.map(s => `• ${s}`).join('\n')}

*注：以上仅为估算，实际赔付金额以保险公司最终核算为准。*`
    : `您的${normalizeClaimType(targetClaim.type)}案件赔付金额为 **${calculation.totalCovered.toLocaleString()} 元**。`;
  
  return {
    success: true,
    data: calculation,
    message,
    uiComponent: UIComponentType.SETTLEMENT_ESTIMATE,
    uiData: calculation
  };
}
```

**Must NOT do**:
- 不修改 `types.ts` 添加新接口（在 `intentTools.ts` 内定义）
- 不修改后端 API
- 不改变现有赔付金额字段

**References**:
- `intentTools.ts:1141-1227` - 现有 `handleQuerySettlementAmount`
- `types.ts:123-135` - `ClaimAssessment` 接口
- `constants.ts:369-737` - Mock 赔案中的 assessment 数据

**Acceptance Criteria**:
- [ ] 医疗险返回分项赔付明细（药品费、检查费、手术费）
- [ ] 车险返回定损金额和赔付比例
- [ ] 意外险返回伤残等级对应赔付金额
- [ ] 提示信息为"估算"，并说明以保险公司核算为准
- [ ] TypeScript 编译通过

**QA Scenarios**:
```
Scenario: 医疗险赔付计算
  Tool: Bash (Node REPL)
  Steps:
    1. 创建医疗险模拟赔案
    2. 调用 calculateSettlementByType(claim, '医疗险')
  Expected Result: 返回分项明细（药品费、检查费、手术费）
  Evidence: .sisyphus/evidence/task4-medical-calc.txt

Scenario: 意外险伤残赔付
  Tool: Bash (Node REPL)
  Steps:
    1. 创建含伤残等级评估的意外险赔案
    2. 调用 calculateSettlementByType(claim, '意外险')
  Expected Result: 返回伤残等级 × 保额的计算结果
  Evidence: .sisyphus/evidence/task4-accident-calc.txt
```

**Commit**: YES
- Message: `feat(intentTools): add type-specific settlement calculation`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 5: 更新查询类函数支持险种差异

**What to do**:
更新所有查询类函数，确保在多赔案场景下正确选择案件，并根据险种类型提供差异化响应。

**需更新的函数**:
1. `handleQuerySettlementAmount` - 已部分在 Task 4 中更新，完成多赔案处理
2. `handleQuerySettlementDetail` - 添加多赔案处理和险种特异性明细
3. `handleQueryPaymentStatus` - 添加多赔案处理和险种特定时效说明

**Implementation - `handleQuerySettlementDetail`**:
```typescript
function handleQuerySettlementDetail(
  entities: IntentEntities,
  claimState: ClaimState
): ToolResponse {
  const claims = claimState.historicalClaims || [];
  
  // 多赔案场景处理
  if (claims.length > 1 && !entities.claimId) {
    return createClaimSelectionResponse(
      claims,
      IntentType.QUERY_SETTLEMENT_DETAIL,
      "您有"
    );
  }
  
  // 获取目标案件
  const targetClaim = entities.claimId
    ? claims.find(c => c.id === entities.claimId)
    : claims[0];
    
  if (!targetClaim) {
    return {
      success: false,
      data: null,
      message: entities.claimId 
        ? `未找到案件号为 "${entities.claimId}" 的案件。`
        : "您还没有理赔案件。"
    };
  }
  
  // 险种特异性明细展示
  const normalizedType = normalizeClaimType(targetClaim.type);
  const calculation = calculateSettlementByType(targetClaim);
  
  const typeSpecificDetails: Record<string, string> = {
    '医疗险': `
🏥 **医疗险赔付明细**

**费用项目**：
${calculation.breakdown.map(item => 
  `• ${item.category}：${item.amount.toLocaleString()}元
   - 赔付比例：${(item.coverageRatio * 100).toFixed(0)}%
   - 赔付金额：${item.coveredAmount.toLocaleString()}元
   - 自付部分：${item.deductible.toLocaleString()}元
   ${item.note ? `- ${item.note}` : ''}`
).join('\n')}

**说明**：医疗险通常设有免赔额和赔付比例限制，社保目录内费用赔付比例更高。`,

    '车险': `
🚗 **车险赔付明细**

**定损项目**：
${calculation.breakdown.map(item => 
  `• ${item.category}：${item.amount.toLocaleString()}元
   - 赔付金额：${item.coveredAmount.toLocaleString()}元
   - 免赔率：${(item.deductible / item.amount * 100).toFixed(0)}%`
).join('\n')}

**说明**：车险赔付根据事故责任比例计算，如负全责通常有 15-20% 的绝对免赔率。`,

    '意外险': `
🛡️ **意外险赔付明细**

**伤残等级**：${calculation.breakdown[0]?.note || '待鉴定'}
**保额**：${calculation.totalAmount.toLocaleString()}元
**赔付金额**：${calculation.totalCovered.toLocaleString()}元
**计算方式**：保额 × 伤残等级赔付比例

**说明**：伤残等级需由专业机构鉴定，1级最重（100%），10级最轻（10%）。`
  };
  
  const detailMessage = typeSpecificDetails[normalizedType] || 
    `赔付明细：\n\n总赔付金额：${calculation.totalCovered.toLocaleString()}元`;
  
  return {
    success: true,
    data: { claim: targetClaim, calculation },
    message: detailMessage,
    uiComponent: UIComponentType.SETTLEMENT_DETAIL,
    uiData: { claim: targetClaim, calculation }
  };
}
```

**Implementation - `handleQueryPaymentStatus`**:
```typescript
function handleQueryPaymentStatus(
  entities: IntentEntities,
  claimState: ClaimState
): ToolResponse {
  const claims = claimState.historicalClaims || [];
  
  // 多赔案场景处理
  if (claims.length > 1 && !entities.claimId) {
    return createClaimSelectionResponse(
      claims,
      IntentType.QUERY_PAYMENT_STATUS,
      "您有"
    );
  }
  
  const targetClaim = entities.claimId
    ? claims.find(c => c.id === entities.claimId)
    : claims[0];
    
  if (!targetClaim) {
    return {
      success: false,
      data: null,
      message: "未找到指定案件。"
    };
  }
  
  // 险种特定时效说明
  const normalizedType = normalizeClaimType(targetClaim.type);
  const typeSpecificTimelines: Record<string, { fast: string; normal: string; note: string }> = {
    '医疗险': { 
      fast: '3-5个工作日', 
      normal: '7-10个工作日',
      note: '小额医疗险通常赔付较快，大额案件需详细审核'
    },
    '车险': { 
      fast: '1-3个工作日', 
      normal: '5-7个工作日',
      note: '无争议案件通常快速赔付，复杂案件需调查'
    },
    '意外险': { 
      fast: '5-7个工作日', 
      normal: '10-15个工作日',
      note: '涉及伤残鉴定的案件时间更长'
    },
    '家财险': { 
      fast: '5-7个工作日', 
      normal: '10-15个工作日',
      note: '需核实财产损失情况'
    },
    '旅行险': { 
      fast: '3-5个工作日', 
      normal: '7-10个工作日',
      note: '需提供完整的旅行凭证'
    }
  };
  
  const timeline = typeSpecificTimelines[normalizedType] || 
    { fast: '3-5个工作日', normal: '7-10个工作日', note: '' };
  
  const paymentInfo = targetClaim.payment;
  const status = paymentInfo?.status || targetClaim.status;
  
  let message: string;
  if (status === ClaimStatus.PAID) {
    message = `✅ 您的${normalizedType}案件赔款已支付。\n\n支付金额：${targetClaim.amount?.toLocaleString()}元\n支付时间：${paymentInfo?.paymentDate || '近期'}`;
  } else if (status === ClaimStatus.PAYING) {
    message = `💳 您的${normalizedType}案件正在打款中。\n\n预计到账时间：${timeline.fast}\n\n${timeline.note}`;
  } else {
    message = `⏳ 您的${normalizedType}案件尚未进入打款阶段。\n\n当前状态：${getStatusLabel(status)}\n预计赔付时效：${timeline.normal}\n\n${timeline.note}`;
  }
  
  return {
    success: true,
    data: { claimId: targetClaim.id, status, paymentInfo },
    message,
    uiComponent: UIComponentType.PAYMENT_STATUS,
    uiData: { claimId: targetClaim.id, status, paymentInfo, timeline }
  };
}
```

**Must NOT do**:
- 不修改 `UIComponentType` 定义
- 不修改后端 API
- 不改变返回类型

**References**:
- `intentTools.ts:1232-1378` - `handleQuerySettlementDetail`
- `intentTools.ts:1440-1524` - `handleQueryPaymentStatus`
- `types.ts:127-135` - `PaymentInfo` 接口
- `types.ts:70-82` - `ClaimStatus` 枚举

**Acceptance Criteria**:
- [ ] `handleQuerySettlementDetail` 处理多赔案场景
- [ ] 医疗险展示分项明细（药品费、检查费、手术费）
- [ ] 车险展示定损明细和免赔率
- [ ] 打款状态查询提供险种特定时效说明
- [ ] TypeScript 编译通过

**QA Scenarios**:
```
Scenario: 多赔案选择后查询赔付明细
  Tool: Playwright
  Steps:
    1. 模拟用户有2个赔案（医疗险+车险）
    2. 询问"赔付明细"
    3. 选择医疗险案件
  Expected Result: 展示医疗险分项明细，不包含车险相关信息
  Evidence: .sisyphus/evidence/task5-multi-claim-detail.png
```

**Commit**: YES
- Message: `feat(intentTools): add multi-claim handling and type-specific details to query functions`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 6: 更新操作类函数支持险种差异

**What to do**:
更新材料相关操作类函数，确保在多赔案场景下正确选择案件，并根据险种提供针对性指导。

**需更新的函数**:
1. `handleViewUploadedDocuments` - 查看已上传材料
2. `handleUploadDocument` - 上传材料（提供险种特定指导）
3. `handleSupplementDocument` - 补充材料
4. `handleReplaceDocument` - 替换材料

**Implementation - `handleViewUploadedDocuments`**:
```typescript
function handleViewUploadedDocuments(
  entities: IntentEntities,
  claimState: ClaimState
): ToolResponse {
  const claims = claimState.historicalClaims || [];
  
  // 多赔案处理
  if (claims.length > 1 && !entities.claimId) {
    return createClaimSelectionResponse(
      claims,
      IntentType.VIEW_UPLOADED_DOCUMENTS,
      "您有"
    );
  }
  
  const targetClaim = entities.claimId
    ? claims.find(c => c.id === entities.claimId)
    : claims[0];
    
  if (!targetClaim) {
    return { success: false, data: null, message: "未找到案件。" };
  }
  
  const normalizedType = normalizeClaimType(targetClaim.type);
  const documents = targetClaim.documents || [];
  
  // 险种特定提示
  const typeSpecificTips: Record<string, string> = {
    '医疗险': '医疗险材料需注意：发票需为原件，病历需加盖医院公章。',
    '车险': '车险材料需注意：事故认定书是必需材料，维修前需先定损。',
    '意外险': '意外险材料需注意：事故证明是关键，需能证明意外性质。',
    '家财险': '家财险材料需注意：财产购买凭证可证明损失价值。',
    '旅行险': '旅行险材料需注意：保留所有额外费用票据。'
  };
  
  const message = documents.length === 0
    ? `您尚未上传任何${normalizedType}材料。\n\n${typeSpecificTips[normalizedType] || ''}`
    : `您已上传 ${documents.length} 份${normalizedType}材料。\n\n${typeSpecificTips[normalizedType] || ''}`;
  
  return {
    success: true,
    data: { claimId: targetClaim.id, documents },
    message,
    uiComponent: UIComponentType.UPLOADED_DOCUMENTS,
    uiData: { claimId: targetClaim.id, documents, claimType: normalizedType }
  };
}
```

**Implementation - `handleUploadDocument`**:
```typescript
function handleUploadDocument(
  entities: IntentEntities,
  claimState: ClaimState
): ToolResponse {
  const claims = claimState.historicalClaims || [];
  
  // 多赔案处理
  if (claims.length > 1 && !entities.claimId) {
    return createClaimSelectionResponse(
      claims,
      IntentType.UPLOAD_DOCUMENT,
      "您有"
    );
  }
  
  const targetClaim = entities.claimId
    ? claims.find(c => c.id === entities.claimId)
    : claims[0];
    
  if (!targetClaim) {
    return { success: false, data: null, message: "未找到案件。" };
  }
  
  const normalizedType = normalizeClaimType(targetClaim.type);
  const requiredMaterials = getRequiredMaterialsForType(normalizedType);
  const uploadedDocs = targetClaim.documents || [];
  const missingMaterials = requiredMaterials.filter(m => 
    !uploadedDocs.some(doc => doc.name?.includes(m.name))
  );
  
  // 险种特定上传指导
  const typeSpecificGuides: Record<string, string> = {
    '医疗险': `
📋 **医疗险材料上传指南**

**必需材料**：${requiredMaterials.map(m => m.name).join('、')}
**还缺**：${missingMaterials.map(m => m.name).join('、') || '无'}

💡 **拍摄建议**：
• 发票需拍摄完整，包括医院公章
• 病历需包含医生签名和诊断结论
• 检查报告需包含检查时间和结果`,

    '车险': `
📋 **车险材料上传指南**

**必需材料**：${requiredMaterials.map(m => m.name).join('、')}
**还缺**：${missingMaterials.map(m => m.name).join('、') || '无'}

💡 **拍摄建议**：
• 驾驶证、行驶证需拍摄正副页
• 事故认定书需拍摄完整页面
• 现场照片需包含车牌和路况`}
  };
  
  return {
    success: true,
    data: { 
      claimId: targetClaim.id, 
      claimType: normalizedType,
      missingMaterials,
      guide: typeSpecificGuides[normalizedType]
    },
    message: typeSpecificGuides[normalizedType] || `请上传${normalizedType}理赔材料。`,
    uiComponent: UIComponentType.DOCUMENT_UPLOADER,
    uiData: { 
      claimId: targetClaim.id, 
      claimType: normalizedType,
      missingMaterials 
    }
  };
}
```

**其他操作函数** (`handleSupplementDocument`, `handleReplaceDocument`):
- 类似模式：添加多赔案处理 + 险种特定提示
- 复用 Task 3 中的缺失材料检测逻辑

**Must NOT do**:
- 不修改文件上传逻辑本身
- 不修改 OSS 上传服务
- 不改变 UI 组件类型

**References**:
- `intentTools.ts:578-631` - `handleViewUploadedDocuments`
- `intentTools.ts:529-545` - `handleUploadDocument`
- `intentTools.ts:550-573` - `handleSupplementDocument`
- `intentTools.ts:636-661` - `handleReplaceDocument`

**Acceptance Criteria**:
- [ ] 4个操作函数都支持多赔案选择
- [ ] 上传材料时显示险种特定指导
- [ ] 查看材料时显示险种特定提示
- [ ] TypeScript 编译通过

**Commit**: YES
- Message: `feat(intentTools): add multi-claim handling and type-specific guidance to document operations`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 7: 集成测试与验证

**What to do**:
1. 完整测试险种标准化系统
2. 验证各险种的材料清单差异化
3. 验证缺失材料检测的准确性
4. 验证赔付计算的合理性
5. 测试多赔案场景下的险种选择

**Test Scenarios**:

| 场景 | 输入 | 期望输出 | 验证方式 |
|------|------|----------|----------|
| 类型标准化 | "车辆理赔" | "车险" | 单元测试 |
| 医疗险材料 | "医疗险" | 6项材料（含出院小结） | 单元测试 |
| 家财险材料 | "家财险" | 6项材料（含房产证） | 单元测试 |
| 医疗险缺失检测 | 缺出院小结 | 提示缺出院小结 | 单元测试 |
| 车险缺失检测 | 缺驾驶证 | 提示缺驾驶证 | 单元测试 |
| 医疗险赔付计算 | 总费用2万 | 返回分项明细 | 单元测试 |
| 多赔案材料查询 | 医疗+车险 | 展示选择列表 | 浏览器测试 |
| 选择后材料展示 | 选择医疗险 | 展示医疗险材料 | 浏览器测试 |

**Acceptance Criteria**:
- [ ] 所有类型别名正确映射
- [ ] 5个险种的材料清单完整
- [ ] 缺失材料检测准确率 > 90%
- [ ] 多赔案选择流程正常工作
- [ ] TypeScript 编译无错误
- [ ] 向后兼容：单赔案用户无感知

**Verification Commands**:
```bash
# TypeScript 编译检查
cd smartclaim-ai-agent && npx tsc --noEmit

# 开发服务器启动
npm run dev
```

**Commit**: NO（测试阶段，如有修复则单独提交）

---

## Verification Strategy

### 测试基础设施评估
- **测试框架**：无（项目未配置 Jest/Vitest）
- **测试策略**：手动验证 + 代码审查

### QA 策略
每个任务完成后应进行以下验证：
1. **TypeScript 编译**：`npx tsc --noEmit` 无错误
2. **单元测试**：使用 Node REPL 验证函数行为
3. **集成测试**：在浏览器中测试实际交互流程
4. **边界测试**：测试 `undefined`、`null`、未知类型

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 1 | `feat(intentTools): add claim type normalization system` | intentTools.ts |
| 2 | `feat(intentTools): extend material lists for home and travel insurance` | intentTools.ts |
| 3 | `feat(intentTools): add type-specific missing materials detection` | intentTools.ts |
| 4 | `feat(intentTools): add type-specific settlement calculation` | intentTools.ts |
| 5 | `feat(intentTools): add multi-claim handling and type-specific details to query functions` | intentTools.ts |
| 6 | `feat(intentTools): add multi-claim handling and type-specific guidance to document operations` | intentTools.ts |

---

## Success Criteria

### 验证命令
```bash
# TypeScript 编译检查
cd smartclaim-ai-agent && npx tsc --noEmit

# 开发服务器启动测试
cd smartclaim-ai-agent && npm run dev
```

### 最终检查清单
- [ ] `CLAIM_TYPE_ALIASES` 包含至少 10 个险种别名映射
- [ ] `normalizeClaimType` 正确标准化所有 mock 数据中的类型值
- [ ] 支持 5+ 险种的材料清单（医疗险、车险、意外险、家财险、旅行险）
- [ ] 缺失材料检测根据险种使用不同的必需材料清单
- [ ] 赔付金额查询提供险种特定的预估计算和说明
- [ ] 所有查询类和操作类函数支持多赔案选择
- [ ] 多赔案场景下展示 `CLAIM_SELECTION` UI
- [ ] TypeScript 编译无错误
- [ ] 向后兼容：单赔案用户向后兼容（体验无变化）

---

## Guardrails & Anti-Patterns

### 明确避免
- **不要**修改 `types.ts` 中的类型定义
- **不要**修改 `constants.ts` 中的 mock 数据
- **不要**添加新的依赖库
- **不要**修改意图识别逻辑（只修改工具执行逻辑）
- **不要**破坏向后兼容（单赔案场景必须正常工作）
- **不要**修改 UI 组件渲染逻辑

### 代码风格
- 使用现有代码的缩进和命名风格
- 所有注释使用中文（与现有代码一致）
- 错误消息保持友好、口语化
- 函数内部先调用 `normalizeClaimType()` 进行类型标准化

### 边界条件与错误处理
- 未知险种类型：返回原值，使用通用处理逻辑
- `claim.type` 为 `undefined`：使用默认值"未知险种"
- 多赔案场景下用户取消选择：保持当前状态
- 所有新函数需处理 `null` 和 `undefined` 输入

---

*计划生成时间：2026-03-04*  
*版本：v1.0*  
*依赖：可与 `intentTools-refactor.md` 并行或顺序执行*