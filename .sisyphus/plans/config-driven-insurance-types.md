# 基于配置体系的险种差异化处理优化方案

## 执行摘要

本方案基于项目现有的**配置化保险产品和理赔框架**，重新设计 `smartclaim-ai-agent` 的险种差异化处理机制。

### 核心转变

| 当前方案 | 优化方案 |
|----------|----------|
| 硬编码材料清单 (`getGenericMaterialsByType`) | 从 `claims-materials.json` + `claim-items.json` 动态加载 |
| 硬编码计算公式 | 复用 `server/rules/` 规则引擎的 ASSESSMENT 域 |
| 硬编码险种类型 | 从 `insurance-types.json` + `products.json` 读取 |
| 代码内规则判断 | 调用 `server/rules/engine.js` 的 `checkEligibility` |
| Mock 数据 | 真实产品配置 (`product-claim-configs.json`) |

---

## 现有配置体系

### 1. 材料配置 (`claims-materials.json`)
```json
{
  "id": "mat-1",
  "name": "身份证正面",
  "description": "...",
  "jsonSchema": "{...}",
  "required": true,
  "aiAuditPrompt": "校验要点：1）身份证号码必须为18位...",
  "sampleUrl": "...",
  "confidenceThreshold": 1
}
```

### 2. 理赔项目-材料映射 (`claim-items.json`)
```json
{
  "id": "item-1",
  "name": "一般住院医疗理赔",
  "materialIds": ["mat-1", "mat-2", "mat-3"],
  "responsibilityIds": ["resp-4", "resp-2"]
}
```

### 3. 规则引擎 (`server/rules/`)
- **执行域**: ELIGIBILITY (责任判断) → ASSESSMENT (金额计算) → POST_PROCESS (后处理)
- **核心文件**: `engine.js`, `conditionEvaluator.js`, `actionExecutor.js`
- **API**: `checkEligibility({ claimCaseId, productCode, ocrData })`

### 4. 计算公式 (`calculation-formulas.json`)
```json
{
  "ACC_MEDICAL": {
    "formula": "min((approved - deductible) * ratio, cap - prior)",
    "variables": { "approved": "claim.approved_expenses", "deductible": "coverage.deductible" }
  }
}
```

---

## 优化架构

```
smartclaim-ai-agent/
├── services/
│   ├── configService.ts          # 配置加载 (claims-materials, claim-items, formulas)
│   ├── materialConfigService.ts  # 材料清单服务 (基于配置)
│   ├── settlementConfigService.ts # 赔付计算服务 (调用规则引擎)
│   └── productConfigService.ts   # 产品查询服务
├── intentTools.ts                # 改造: 使用配置服务
└── constants.ts                  # 精简: 移除硬编码材料清单
```

---

## 详细任务规划

### Task 1: 创建配置服务

**What to do**:
创建统一的配置加载服务，从主项目 jsonlist 目录读取配置并缓存。

**Implementation**:
```typescript
// services/configService.ts
export class ConfigService {
  private cache = new Map<string, any>();
  
  async loadMaterials(): Promise<MaterialConfig[]> {
    return this.loadCached('materials', '../jsonlist/claims-materials.json');
  }
  
  async loadClaimItems(): Promise<ClaimItemConfig[]> {
    return this.loadCached('claimItems', '../jsonlist/claim-items.json');
  }
  
  async loadFormulas(): Promise<FormulaConfig[]> {
    return this.loadCached('formulas', '../jsonlist/calculation-formulas.json');
  }
  
  async loadInsuranceTypes(): Promise<InsuranceTypeConfig[]> {
    return this.loadCached('types', '../jsonlist/insurance-types.json');
  }
  
  private async loadCached(key: string, path: string): Promise<any> {
    if (this.cache.has(key)) return this.cache.get(key);
    const data = await fetch(`/api/config?path=${path}`).then(r => r.json());
    this.cache.set(key, data);
    return data;
  }
}
```

**Acceptance Criteria**:
- [ ] 所有配置文件可正确加载
- [ ] 缓存机制正常工作
- [ ] 加载失败时返回空数组并记录错误

**Commit**: `feat(config): add config service for loading product configurations`

---

### Task 2: 创建材料配置服务

**What to do**:
基于配置创建材料清单查询服务，替代硬编码的 `getGenericMaterialsByType`。

**Implementation**:
```typescript
// services/materialConfigService.ts
export class MaterialConfigService {
  constructor(private configService: ConfigService) {}
  
  /**
   * 根据理赔项目ID查询材料清单
   */
  async getMaterialsByClaimItem(claimItemId: string): Promise<MaterialItem[]> {
    const [items, materials] = await Promise.all([
      this.configService.loadClaimItems(),
      this.configService.loadMaterials()
    ]);
    
    const claimItem = items.find(i => i.id === claimItemId);
    if (!claimItem) return [];
    
    return claimItem.materialIds
      .map(id => materials.find(m => m.id === id))
      .filter(Boolean)
      .map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        required: true,
        sampleUrl: m.sampleUrl
      }));
  }
  
  /**
   * 根据险种类型查询材料清单
   */
  async getMaterialsByType(claimType: string): Promise<MaterialItem[]> {
    // 险种类型映射到 claim-item
    const typeToItemMap: Record<string, string> = {
      '医疗险': 'item-medical-general',
      '住院医疗': 'item-medical-inpatient',
      '重疾险': 'item-critical-illness',
      '意外险': 'item-accident-general',
      '车险': 'item-auto-accident'
    };
    
    const claimItemId = typeToItemMap[claimType];
    if (!claimItemId) return [];
    
    return this.getMaterialsByClaimItem(claimItemId);
  }
  
  /**
   * 检测缺失材料
   */
  async detectMissingMaterials(
    claimItemId: string,
    uploadedDocs: ClaimDocument[]
  ): Promise<MaterialItem[]> {
    const requiredMaterials = await this.getMaterialsByClaimItem(claimItemId);
    const uploadedCategories = new Set(uploadedDocs.map(d => d.category));
    
    return requiredMaterials.filter(m => {
      // 根据材料名称匹配文档类别
      return !Array.from(uploadedCategories).some(cat => 
        m.name.includes(cat) || cat.includes(m.name)
      );
    });
  }
}
```

**Acceptance Criteria**:
- [ ] 可通过 claimItemId 查询材料清单
- [ ] 可通过 claimType 查询材料清单（自动映射）
- [ ] 正确识别已上传和缺失的材料
- [ ] 无配置时返回空数组（不报错）

**Commit**: `feat(material): create config-driven material service`

---

### Task 3: 创建赔付计算服务

**What to do**:
创建服务调用规则引擎进行赔付计算，替代硬编码计算逻辑。

**Implementation**:
```typescript
// services/settlementConfigService.ts
export class SettlementConfigService {
  /**
   * 调用规则引擎进行赔付计算
   */
  async calculateSettlement(
    claimCaseId: string,
    productCode: string,
    ocrData?: any
  ): Promise<SettlementResult | null> {
    try {
      // 调用 server/rules/engine.js 的 checkEligibility
      const response = await fetch('/api/claims/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimCaseId, productCode, ocrData })
      });
      
      if (!response.ok) return null;
      
      const result = await response.json();
      return {
        finalAmount: result.totalAmount,
        steps: result.calculationSteps || [],
        breakdown: result.itemBreakdown || [],
        explanation: this.generateExplanation(result)
      };
    } catch (error) {
      console.error('Settlement calculation failed:', error);
      return null;
    }
  }
  
  /**
   * 使用计算公式配置进行估算
   */
  async estimateSettlement(
    claimType: string,
    params: { approvedExpenses?: number; disabilityGrade?: number; sumInsured?: number }
  ): Promise<EstimateResult | null> {
    const formulas = await this.configService.loadFormulas();
    
    // 根据险种选择公式
    const formulaName = this.mapTypeToFormula(claimType, params);
    const formula = formulas[formulaName];
    if (!formula) return null;
    
    // 提取变量值
    const variables = this.extractVariables(formula.variables, params);
    
    // 执行计算
    const result = this.executeFormula(formula, variables);
    
    return {
      estimatedAmount: result.finalAmount,
      formula: formula.description,
      steps: result.steps,
      isEstimate: true
    };
  }
  
  private mapTypeToFormula(type: string, params: any): string {
    const map: Record<string, string> = {
      '医疗险': 'HEALTH_MEDICAL',
      '意外险': params.disabilityGrade ? 'ACC_DISABILITY' : 'ACC_MEDICAL',
      '重疾险': 'CRITICAL_ILLNESS',
      '车险': 'AUTO_INSURANCE'
    };
    return map[type] || 'GENERIC';
  }
  
  private generateExplanation(result: any): string {
    return `根据产品条款和理赔规则计算，最终赔付金额为 ${result.totalAmount?.toLocaleString()} 元`;
  }
}
```

**Acceptance Criteria**:
- [ ] 可调用规则引擎进行精确计算
- [ ] 可使用公式配置进行估算
- [ ] 返回计算步骤和说明
- [ ] 计算失败时返回 null（不报错）

**Commit**: `feat(settlement): create settlement calculation service with rules engine integration`

---

### Task 4: 重构 intentTools - 材料查询

**What to do**:
重构 `handleQueryMaterialsList` 使用配置服务。

**Implementation**:
```typescript
// intentTools.ts - 重构后的 handleQueryMaterialsList
async function handleQueryMaterialsList(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const claims = claimState.historicalClaims || [];
  
  // 场景1: 无赔案
  if (claims.length === 0) {
    return handleNoClaimsMaterialsQuery(entities);
  }
  
  // 多赔案场景
  if (claims.length > 1 && !entities.claimId) {
    return createClaimSelectionResponse(claims, IntentType.QUERY_MATERIALS_LIST, "您有");
  }
  
  const targetClaim = entities.claimId
    ? claims.find(c => c.id === entities.claimId)
    : claims[0];
    
  if (!targetClaim) {
    return { success: false, data: null, message: "未找到案件。" };
  }
  
  // 使用配置服务获取材料清单
  const materials = await materialConfigService.getMaterialsByType(targetClaim.type);
  
  if (materials.length > 0) {
    // 有配置，使用配置的材料
    const missingMaterials = await materialConfigService.detectMissingMaterials(
      targetClaim.claimItemId,
      targetClaim.documents || []
    );
    
    return {
      success: true,
      data: { materials, missingMaterials, claimType: targetClaim.type },
      message: generateConfigBasedMessage(materials, missingMaterials),
      uiComponent: UIComponentType.MATERIALS_LIST,
      uiData: { materials, claimType: targetClaim.type }
    };
  }
  
  // 无配置，降级到通用处理
  return fetchAndReturnMaterials(targetClaim.type, entities.productCode);
}

function generateConfigBasedMessage(materials: MaterialItem[], missing: MaterialItem[]): string {
  const required = materials.filter(m => m.required);
  return `根据您的产品条款，需要准备以下材料：

📋 **必需材料 (${required.length}项)**：
${required.map(m => `• ${m.name}：${m.description}`).join('\n')}

${missing.length > 0 ? `
⚠️ **还缺材料 (${missing.length}项)**：
${missing.map(m => `• ${m.name}`).join('\n')}
` : ''}`;
}
```

**Acceptance Criteria**:
- [ ] 使用配置服务获取材料清单
- [ ] 有配置时使用配置，无配置时降级
- [ ] 正确识别缺失材料
- [ ] 生成险种特定的提示信息

**Commit**: `refactor(intentTools): use config service for materials query`

---

### Task 5: 重构 intentTools - 缺失材料查询

**What to do**:
重构 `handleQueryMissingMaterials` 使用配置服务。

**Implementation**:
```typescript
async function handleQueryMissingMaterials(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const claims = claimState.historicalClaims || [];
  
  if (claims.length === 0) {
    return { success: true, message: "您还没有理赔案件。", nextAction: { type: 'form', target: 'claim-report' } };
  }
  
  // 多赔案处理
  if (claims.length > 1 && !entities.claimId) {
    return createClaimSelectionResponse(claims, IntentType.QUERY_MISSING_MATERIALS, "您有");
  }
  
  const targetClaim = entities.claimId
    ? claims.find(c => c.id === entities.claimId)
    : claims[0];
    
  if (!targetClaim) {
    return { success: false, message: "未找到案件。" };
  }
  
  // 使用配置服务检测缺失材料
  const missingMaterials = await materialConfigService.detectMissingMaterials(
    targetClaim.claimItemId || this.mapTypeToClaimItem(targetClaim.type),
    targetClaim.documents || []
  );
  
  if (missingMaterials.length === 0) {
    return {
      success: true,
      data: { claimId: targetClaim.id, isComplete: true },
      message: `您的案件材料已齐全，无需补充。`,
      uiComponent: UIComponentType.MISSING_MATERIALS,
      uiData: { claimId: targetClaim.id, missingItems: [], isComplete: true }
    };
  }
  
  // 获取险种特定的提示
  const guide = await materialConfigService.getMaterialUploadGuide(targetClaim.type);
  
  return {
    success: true,
    data: { claimId: targetClaim.id, missingItems: missingMaterials },
    message: `您的案件还缺少以下必需材料：

${missingMaterials.map(m => `• **${m.name}**：${m.description}`).join('\n')}

${guide}`,
    uiComponent: UIComponentType.MISSING_MATERIALS,
    uiData: { claimId: targetClaim.id, missingItems: missingMaterials }
  };
}
```

**Acceptance Criteria**:
- [ ] 使用配置服务检测缺失材料
- [ ] 提供险种特定的上传指导
- [ ] 处理多赔案场景

**Commit**: `refactor(intentTools): use config service for missing materials detection`

---

### Task 6: 重构 intentTools - 赔付查询

**What to do**:
重构 `handleQuerySettlementAmount` 和 `handleQuerySettlementDetail` 使用配置服务。

**Implementation**:
```typescript
async function handleQuerySettlementAmount(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const claims = claimState.historicalClaims || [];
  
  if (claims.length === 0) {
    return handleNoClaimsSettlementEstimate(entities);
  }
  
  if (claims.length > 1 && !entities.claimId) {
    return createClaimSelectionResponse(claims, IntentType.QUERY_SETTLEMENT_AMOUNT, "您有");
  }
  
  const targetClaim = entities.claimId
    ? claims.find(c => c.id === entities.claimId)
    : claims[0];
    
  if (!targetClaim) {
    return { success: false, message: "未找到案件。" };
  }
  
  // 尝试调用规则引擎获取精确计算
  if (targetClaim.productCode) {
    const result = await settlementConfigService.calculateSettlement(
      targetClaim.id,
      targetClaim.productCode
    );
    
    if (result) {
      return {
        success: true,
        data: result,
        message: result.explanation,
        uiComponent: UIComponentType.SETTLEMENT_ESTIMATE,
        uiData: result
      };
    }
  }
  
  // 降级到估算
  const estimate = await settlementConfigService.estimateSettlement(
    targetClaim.type,
    { approvedExpenses: targetClaim.amount, sumInsured: targetClaim.coverageAmount }
  );
  
  if (estimate) {
    return {
      success: true,
      data: estimate,
      message: `根据您的产品条款初步估算：

💰 **预估赔付金额：${estimate.estimatedAmount?.toLocaleString()} 元**

计算方式：${estimate.formula}

*注：此为估算金额，最终赔付以审核结果为准。*`,
      uiComponent: UIComponentType.SETTLEMENT_ESTIMATE,
      uiData: estimate
    };
  }
  
  // 最终降级
  return { success: true, message: `您的案件正在审核中，请耐心等待。` };
}
```

**Acceptance Criteria**:
- [ ] 优先调用规则引擎进行精确计算
- [ ] 无法精确计算时使用公式估算
- [ ] 返回计算步骤和说明
- [ ] 处理多赔案场景

**Commit**: `refactor(intentTools): use config service for settlement calculation`

---

### Task 7: 清理硬编码数据

**What to do**:
清理 `constants.ts` 和 `intentTools.ts` 中的硬编码材料清单。

**Changes**:
1. 删除 `getGenericMaterialsByType` 中的硬编码材料定义
2. 保留函数但改为调用 `materialConfigService`
3. 删除 `getGenericMaterialsForNoClaims` 中的硬编码数据
4. 更新 `handleNoClaimsMaterialsQuery` 使用配置服务

**Commit**: `cleanup(constants): remove hardcoded material lists in favor of config-driven approach`

---

## 系统集成点

### API 接口需求

需要在主项目中添加以下 API（如果不存在）：

```typescript
// GET /api/config/claims-materials
// 返回 claims-materials.json

// GET /api/config/claim-items
// 返回 claim-items.json

// POST /api/claims/calculate
// 调用 server/rules/engine.js 的 checkEligibility
// Body: { claimCaseId, productCode, ocrData }
```

### 缓存策略

```typescript
// 配置缓存（内存 + localStorage）
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

// 启动时预加载常用配置
async function preloadConfigs() {
  await Promise.all([
    configService.loadMaterials(),
    configService.loadInsuranceTypes()
  ]);
}
```

---

## 验证策略

### 测试场景

| 场景 | 输入 | 期望输出 |
|------|------|----------|
| 医疗险材料查询 | claimType="医疗险" | 返回配置的医疗险材料清单 |
| 材料缺失检测 | 已上传身份证，缺病历 | 提示缺少病历材料 |
| 赔付估算 | 医疗险，发票5000元 | 返回分项计算结果 |
| 无配置降级 | 未知险种类型 | 返回通用提示，不报错 |
| 多赔案选择 | 2个案件 | 展示案件选择列表 |

### 验证命令

```bash
cd smartclaim-ai-agent
npx tsc --noEmit
npm run dev
```

---

## Commit 策略

| Task | Commit Message |
|------|----------------|
| 1 | `feat(config): add config service for loading product configurations` |
| 2 | `feat(material): create config-driven material service` |
| 3 | `feat(settlement): create settlement calculation service with rules engine integration` |
| 4 | `refactor(intentTools): use config service for materials query` |
| 5 | `refactor(intentTools): use config service for missing materials detection` |
| 6 | `refactor(intentTools): use config service for settlement calculation` |
| 7 | `cleanup(constants): remove hardcoded material lists` |

---

## 成功标准

- [ ] 所有材料清单从配置加载，无硬编码
- [ ] 赔付计算可调用规则引擎或公式配置
- [ ] 支持 5+ 险种的差异化处理
- [ ] 多赔案场景正常工作
- [ ] 无配置时优雅降级
- [ ] TypeScript 编译无错误
- [ ] 向后兼容（单赔案场景无感知）

---

## 与现有计划的关系

本方案与 `intentTools-refactor.md` 是**互补关系**：

- `intentTools-refactor.md`: 解决多赔案选择的基础框架问题
- 本方案: 基于配置体系实现险种差异化处理

**推荐执行顺序**:
1. 先执行 `intentTools-refactor.md` Task 1-3（基础案件选择设施）
2. 然后执行本方案 Task 1-3（配置服务层）
3. 然后并行执行本方案 Task 4-6（重构 intentTools）
4. 最后执行 Task 7（清理硬编码数据）

---

*计划生成时间：2026-03-04*  
*基于代码版本：主项目配置体系 + smartclaim-ai-agent*
