# 理赔意图处理逻辑重构计划

## Context

### 原始需求
修复 `intentTools.ts` 中理赔赔案相关意图处理的缺陷，确保正确处理用户无赔案、有1个赔案、有多个赔案三种场景。

### 当前问题
1. **`handleQueryMaterialsList` (P0)** - 完全没有检查赔案数量，直接取第一个案件类型
2. **`findTargetClaim` 辅助函数** - 用户有多个赔案时直接返回第一个，未让用户选择
3. **16个使用 `findTargetClaim` 的函数** - 都需要统一处理多赔案场景

### 用户确认的需求
- 无赔案时：提供通用材料示例（医疗险/车险/意外险）+ 引导报案
- 多赔案时：展示选择列表 → 用户选择后自动重新触发原意图
- 修复优先级：P0材料查询 > P1缺失材料 > P2其他查询 > P3操作类

---

## Work Objectives

### 核心目标
重构 `intentTools.ts`，实现基于赔案数量的分支处理逻辑，确保所有理赔相关意图在无赔案、单赔案、多赔案场景下都有正确的用户体验。

### 具体交付物
1. 重构 `handleQueryMaterialsList` 函数 (line 196-244)
2. 增强或替换 `findTargetClaim` 辅助函数 (line 1372-1380)
3. 修复 `handleQueryMissingMaterials` 函数 (line 249-316)
4. 修复 `handleQuerySettlementAmount` 函数 (line 670-729)
5. 修复 `handleQuerySettlementDetail` 函数 (line 734-788)
6. 修复 `handleQueryPaymentStatus` 函数 (line 865-907)
7. 修复材料类操作函数 (上传/补充/查看/替换)
8. 修复其他操作类函数 (催办/留言/投诉/确认赔付等)

### 定义完成标准
- [ ] `handleQueryMaterialsList` 正确处理三种赔案场景
- [ ] 无赔案时提供通用材料示例并引导报案
- [ ] 多赔案时展示 `CLAIM_SELECTION` UI 组件
- [ ] 用户选择案件后自动重新触发原意图
- [ ] 所有修复的函数都有清晰的验收测试步骤

### 必须包含
- 无赔案时的通用材料示例（医疗险、车险、意外险）
- 统一的案件选择处理逻辑
- 案件选择后的意图重触发机制
- 向后兼容（不破坏现有单赔案流程）

### 明确排除
- 不修改意图识别逻辑（`intentService.ts` 保持原样）
- 不修改类型定义（`types.ts` 保持原样）
- 不添加后端 API 调用（保持现有 mock/前端逻辑）
- 不修改 UI 组件渲染逻辑（只修改数据准备逻辑）

---

## Verification Strategy

### 测试基础设施评估
- **测试框架**：无（项目未配置 Jest/Vitest）
- **测试策略**：手动验证（通过浏览器或交互式测试）

### 手动验证计划
每个 TODO 包含以下验证步骤：
1. **代码审查**：TypeScript 编译无错误
2. **场景测试**：模拟三种赔案场景的函数调用
3. **浏览器验证**：在 AI Agent 界面中测试实际交互流程

---

## Task Flow

```
Task 1 (基础设施)
  ↓
Task 2 (P0-材料查询) 
  ↓
Task 3 (P1-缺失材料)
  ↓
Task 4 (P2-查询类)
  ↓
Task 5 (P3-操作类)
  ↓
Task 6 (集成测试)
```

### 并行化策略
- 任务 4 内部的 3 个查询函数可并行修改（彼此独立）
- 任务 5 内部的 8 个操作函数可分批并行修改

---

## TODOs

### Task 1: 建立通用案件选择基础设施

**What to do**:
- 在 `intentTools.ts` 中创建新的辅助函数 `resolveTargetClaim`
- 该函数返回 `{ claim, needsSelection, claims, error }` 结构
- 实现通用的案件选择响应生成逻辑
- 添加通用材料示例数据（医疗险、车险、意外险）

**Must NOT do**:
- 不修改现有 `findTargetClaim` 函数（保持向后兼容）
- 不添加新的依赖库
- 不修改其他文件

**References**:
- `intentTools.ts:1372-1380` - 现有 `findTargetClaim` 实现模式
- `intentTools.ts:158-166` - `handleQueryProgress` 中案件选择响应示例
- `types.ts:369` - `IntentType.QUERY_MATERIALS_LIST` 定义
- `types.ts:510` - `UIComponentType.CLAIM_SELECTION` 定义

**Acceptance Criteria**:
- [ ] TypeScript 编译通过：`npx tsc --noEmit` 无错误
- [ ] 新函数签名：
  ```typescript
  interface ClaimResolutionResult {
    claim?: HistoricalClaim;
    needsSelection?: boolean;
    claims?: HistoricalClaim[];
    error?: string;
  }
  function resolveTargetClaim(
    entities: IntentEntities, 
    claimState: ClaimState
  ): ClaimResolutionResult
  ```
- [ ] 包含通用材料示例函数：
  ```typescript
  function getGenericMaterialsByType(claimType?: string): MaterialItem[]
  ```

**Commit**: YES
- Message: `refactor(intentTools): add claim resolution infrastructure`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 2: 重构 handleQueryMaterialsList (P0)

**What to do**:
完全重构 `handleQueryMaterialsList` 函数，实现以下分支逻辑：

1. **无赔案场景**:
   - 返回通用材料示例（根据 `entities.claimType` 或返回所有类型示例）
   - 消息说明：不同险种材料不同，提供医疗险/车险/意外险示例
   - 引导用户报案：提供 `nextAction` 指向报案表单

2. **单个赔案场景**:
   - 获取该赔案的类型
   - 调用 `fetchMaterialsList` 获取具体材料清单
   - 返回材料清单 UI

3. **多个赔案场景**:
   - 返回案件选择 UI (`UIComponentType.CLAIM_SELECTION`)
   - 提示用户选择要查询的赔案

**Must NOT do**:
- 不修改 `fetchMaterialsList` 函数内部逻辑
- 不改变返回类型 `Promise<ToolResponse>`
- 不添加新的 UI 组件类型

**References**:
- `intentTools.ts:196-244` - 当前 `handleQueryMaterialsList` 实现
- `intentTools.ts:124-191` - `handleQueryProgress` 正确实现参考
- `intentTools.ts:1554-1579` - `getDefaultMaterials` 材料清单示例
- `types.ts:561-564` - `MaterialsListInfo` 类型定义

**Implementation Details**:
```typescript
async function handleQueryMaterialsList(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const claims = claimState.historicalClaims || [];
  
  // 场景1: 无赔案
  if (claims.length === 0) {
    return handleNoClaimsMaterialsQuery(entities);
  }
  
  // 场景3: 多个赔案
  if (claims.length > 1 && !entities.claimId) {
    return {
      success: true,
      data: { claims },
      message: `您有 ${claims.length} 个理赔案件，请选择要查询材料清单的案件：`,
      uiComponent: UIComponentType.CLAIM_SELECTION,
      uiData: { claims, intent: IntentType.QUERY_MATERIALS_LIST }
    };
  }
  
  // 场景2: 单个赔案 或 已指定 claimId
  const targetClaim = entities.claimId 
    ? claims.find(c => c.id === entities.claimId)
    : claims[0];
    
  // ... 获取材料清单逻辑
}
```

**Acceptance Criteria**:
- [ ] TypeScript 编译通过
- [ ] 无赔案场景测试：
  ```typescript
  const result = await handleQueryMaterialsList({}, { historicalClaims: [] });
  // 期望: success=true, message 包含材料示例, nextAction 指向报案
  ```
- [ ] 单赔案场景测试：
  ```typescript
  const result = await handleQueryMaterialsList({}, { historicalClaims: [{ id: 'CLM001', type: '医疗险' }] });
  // 期望: 返回该医疗险的材料清单
  ```
- [ ] 多赔案场景测试：
  ```typescript
  const result = await handleQueryMaterialsList({}, { historicalClaims: [{ id: 'CLM001' }, { id: 'CLM002' }] });
  // 期望: uiComponent=CLAIM_SELECTION
  ```

**Commit**: YES
- Message: `fix(intentTools): refactor handleQueryMaterialsList for claim-aware logic`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 3: 重构 handleQueryMissingMaterials (P1)

**What to do**:
重构 `handleQueryMissingMaterials` 函数，添加多赔案处理逻辑：

1. **无赔案场景**: 保持现有逻辑，返回提示信息
2. **单个赔案场景**: 保持现有逻辑，查询缺失材料
3. **多个赔案场景**: 返回案件选择 UI，让用户选择后查询

**Must NOT do**:
- 不修改缺失材料检测逻辑
- 不改变返回数据结构

**References**:
- `intentTools.ts:249-316` - 当前实现
- `intentTools.ts:124-191` - 案件选择逻辑参考

**Acceptance Criteria**:
- [ ] TypeScript 编译通过
- [ ] 多赔案场景返回 `CLAIM_SELECTION` UI
- [ ] 单赔案场景正常工作
- [ ] 无赔案场景返回友好提示

**Commit**: YES
- Message: `fix(intentTools): handle multiple claims in query missing materials`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 4: 修复查询类函数 (P2)

并行修复以下3个查询函数：

#### Task 4.1: handleQuerySettlementAmount

**What to do**:
- 添加多赔案处理逻辑
- 无赔案时返回提示
- 多赔案时展示选择列表

**References**: `intentTools.ts:670-729`

**Acceptance Criteria**:
- [ ] 多赔案场景返回 `CLAIM_SELECTION`
- [ ] 单赔案/无赔案场景正常工作

**Commit**: YES (batch commit with 4.2, 4.3)

#### Task 4.2: handleQuerySettlementDetail

**What to do**:
- 添加多赔案处理逻辑
- 无赔案时返回提示
- 多赔案时展示选择列表

**References**: `intentTools.ts:734-788`

**Acceptance Criteria**:
- [ ] 多赔案场景返回 `CLAIM_SELECTION`
- [ ] 单赔案/无赔案场景正常工作

#### Task 4.3: handleQueryPaymentStatus

**What to do**:
- 添加多赔案处理逻辑
- 无赔案时返回提示
- 多赔案时展示选择列表

**References**: `intentTools.ts:865-907`

**Acceptance Criteria**:
- [ ] 多赔案场景返回 `CLAIM_SELECTION`
- [ ] 单赔案/无赔案场景正常工作

**Commit**: YES
- Message: `fix(intentTools): handle multiple claims in settlement and payment queries`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 5: 修复操作类函数 (P3)

分批修复以下操作类函数，添加多赔案选择逻辑：

#### Task 5.1: 材料操作函数

修复4个材料相关函数：
- `handleUploadDocument` (line 529-545)
- `handleSupplementDocument` (line 550-573)
- `handleViewUploadedDocuments` (line 578-631)
- `handleReplaceDocument` (line 636-661)

**What to do**:
- 每个函数添加多赔案处理
- 多赔案时先选择，再执行对应操作
- 保持现有单赔案逻辑不变

**Acceptance Criteria**:
- [ ] 4个函数都支持多赔案选择
- [ ] TypeScript 编译通过

**Commit**: YES
- Message: `fix(intentTools): handle multiple claims in document operations`

#### Task 5.2: 其他操作函数

修复以下函数：
- `handleExpediteClaim` (line 1141-1176)
- `handleLeaveMessage` (line 1181-1196)
- `handleFileComplaint` (line 1120-1136)
- `handleConfirmSettlement` (line 1224-1254)
- `handleRejectSettlement` (line 1259-1284)
- `handleSignAgreement` (line 1289-1312)
- `handleModifyClaimReport` (line 448-481)
- `handleCancelClaim` (line 486-520)

**What to do**:
- 每个函数添加多赔案处理逻辑
- 注意这些函数可能有额外的状态检查（如只能修改特定状态的案件）

**Acceptance Criteria**:
- [ ] 8个函数都支持多赔案选择
- [ ] 状态检查逻辑在多赔案场景下正常工作
- [ ] TypeScript 编译通过

**Commit**: YES
- Message: `fix(intentTools): handle multiple claims in claim operations`
- Files: `smartclaim-ai-agent/intentTools.ts`

---

### Task 6: 实现案件选择后自动重触发意图

**What to do**:
在 `App.tsx` 的消息处理流程中实现案件选择后的意图重触发：

1. **传递原始意图**: 在 Task 2-5 返回 `CLAIM_SELECTION` 时，通过 `uiData.intent` 传递原始意图类型
2. **选择案件触发**: 当用户从 `CLAIM_SELECTION` 组件选择案件时：
   - 发送包含 `claimId` 和 `originalIntent` 的消息
   - 或者直接调用 `executeTool(originalIntent, { claimId }, claimState)`
3. **显示结果**: 将工具执行结果渲染为消息

**Implementation Approach**:
在 `App.tsx` 中找到消息处理逻辑（通常在 `handleSendMessage` 或类似函数中）：

```typescript
// 检测是否是案件选择事件
if (message.uiComponent === UIComponentType.CLAIM_SELECTION && selectedClaimId) {
  const originalIntent = message.uiData?.intent;
  if (originalIntent) {
    // 重新执行原意图，传入选中的 claimId
    const result = await executeTool(
      originalIntent, 
      { ...entities, claimId: selectedClaimId }, 
      claimState
    );
    // 将结果渲染为 AI 回复
    displayToolResponse(result);
  }
}
```

**Must NOT do**:
- 不修改 `IntentType` 枚举
- 不添加新的意图类型
- 不修改 `types.ts`

**References**:
- `App.tsx` - 消息处理主逻辑（需要查找具体函数名和位置）
- `intentTools.ts:52` - `TOOL_REGISTRY` 中工具调用方式
- `intentService.ts:353-358` - `executeIntentTool` 函数

**Acceptance Criteria**:
- [ ] 用户选择案件后自动查询该案件信息
- [ ] 选择案件的操作与原意图一致
- [ ] 无需用户重新输入查询指令
- [ ] 案件选择响应包含原始意图信息（在 `uiData.intent` 中）

**Commit**: YES
- Message: `feat(app): auto-retrigger intent after claim selection`
- Files: `smartclaim-ai-agent/App.tsx`, `smartclaim-ai-agent/intentTools.ts`

---

### Task 7: 集成测试与验证

**What to do**:
1. 完整测试三种赔案场景下的所有修复功能
2. 验证案件选择后自动重触发逻辑
3. 确保向后兼容（单赔案用户无感知）

**Test Scenarios**:

| 场景 | 输入 | 期望输出 |
|------|------|----------|
| 无赔案+材料查询 | "需要什么材料" | 通用材料示例 + 报案引导 |
| 单赔案+材料查询 | "需要什么材料" | 该案件类型对应的材料清单 |
| 多赔案+材料查询 | "需要什么材料" | 案件选择列表 |
| 多赔案+选择案件 | 选择 CLM001 | 自动显示 CLM001 的材料清单 |
| 无赔案+进度查询 | "查进度" | "您还没有理赔案件" |
| 多赔案+进度查询 | "查进度" | 案件选择列表 → 显示选中案件进度 |
| 单赔案+任意操作 | 任意意图 | 直接操作该案件（与以前一致）|

**Acceptance Criteria**:
- [ ] 所有P0/P1功能测试通过
- [ ] 所有P2功能测试通过
- [ ] 所有P3功能测试通过
- [ ] 向后兼容验证通过

**Commit**: NO（测试阶段，如有修复则单独提交）

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 1 | `refactor(intentTools): add claim resolution infrastructure` | intentTools.ts |
| 2 | `fix(intentTools): refactor handleQueryMaterialsList for claim-aware logic` | intentTools.ts |
| 3 | `fix(intentTools): handle multiple claims in query missing materials` | intentTools.ts |
| 4.1-4.3 | `fix(intentTools): handle multiple claims in settlement and payment queries` | intentTools.ts |
| 5.1 | `fix(intentTools): handle multiple claims in document operations` | intentTools.ts |
| 5.2 | `fix(intentTools): handle multiple claims in claim operations` | intentTools.ts |
| 6 | `feat(intentService): auto-retrigger intent after claim selection` | intentService.ts |

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
- [ ] `handleQueryMaterialsList` 正确处理无/单/多三种赔案场景
- [ ] 无赔案时提供医疗险/车险/意外险通用材料示例
- [ ] 无赔案时引导用户报案
- [ ] 多赔案时展示 `CLAIM_SELECTION` UI
- [ ] 案件选择后自动重新触发原意图
- [ ] 所有查询类函数支持多赔案选择
- [ ] 所有操作类函数支持多赔案选择
- [ ] TypeScript 编译无错误
- [ ] 单赔案用户向后兼容（体验无变化）

---

## Guardrails & Anti-Patterns

### 明确避免
- **不要**修改 `IntentType` 枚举
- **不要**修改 `types.ts` 中的类型定义
- **不要**添加新的依赖库
- **不要**修改意图识别逻辑（只修改工具执行逻辑）
- **不要**破坏向后兼容（单赔案场景必须正常工作）

### 代码风格
- 使用现有代码的缩进和命名风格
- 所有注释使用中文（与现有代码一致）
- 错误消息保持友好、口语化

### 边界条件与错误处理
- `historicalClaims` 为 `undefined` 时视为空数组
- `entities.claimId` 指定的案件不存在时返回错误提示："未找到案件号为 'XXX' 的案件，请检查案件号是否正确。"
- 用户选择案件后再次选择同一案件应正常处理（幂等）
- 多赔案场景下用户取消选择 → 保持当前状态，等待用户重新选择或输入新指令
- `claimState` 为 `null` 或 `undefined` → 视为无赔案处理

### 测试验证步骤
每个 Task 完成后应进行以下验证：
1. **TypeScript 编译**: `cd smartclaim-ai-agent && npx tsc --noEmit`
2. **开发服务器启动**: `npm run dev` 无错误
3. **场景测试**: 在浏览器中测试三种赔案场景
4. **边界测试**: 测试 `undefined`、`null`、空数组等边界条件
5. **向后兼容**: 验证单赔案用户场景无变化
