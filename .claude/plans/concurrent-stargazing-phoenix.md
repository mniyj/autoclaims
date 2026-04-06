# 人工介入（Human-in-the-Loop）状态机设计方案

## 背景

理赔处理流水线有4个自动化阶段（受理 → 解析/OCR → 定责 → 定损），但缺少结构化的人工介入节点。当 AI 置信度低、材料校验规则不通过、或规则引擎路由到人工时，系统需要显式的子状态机来跟踪人工审核生命周期、引导理赔员操作，并支持双向流转（继续推进或打回上一阶段）。

---

## 三个人工介入点

### 介入点 1：材料识别置信度不足（解析阶段内）
**触发条件**：OCR/AI 提取字段置信度 < 预设阈值
**转人工原因**：`"字段 [X] 的 AI 识别置信度为 Y%，低于阈值 Z%，需人工核对"`

```
IDLE → REVIEW_CREATED → REVIEW_IN_PROGRESS → CORRECTION_SUBMITTED → RESOLVED_PROCEED
                                            ↘ RESOLVED_ACCEPT_AS_IS
                        CORRECTION_SUBMITTED → RE_EXTRACTION_PENDING → RE_EXTRACTION_RUNNING
                                                                      ↘ REVIEW_CREATED (置信度仍低，循环)
                                                                      ↘ RESOLVED_PROCEED
```

### 介入点 2：材料校验规则不通过（解析→定责 之间的关卡）
**触发条件**：校验规则 `failure_action: MANUAL_REVIEW` 且校验失败
**转人工原因**：`"校验规则 [规则名] 不通过：[message_template]，如：发票患者姓名与病历姓名不一致"`

```
IDLE → VALIDATION_FAILED → PENDING_ADJUSTER_REVIEW → ADJUSTER_OVERRIDE → RESOLVED_PROCEED
                                                    ↘ PENDING_REUPLOAD → REUPLOAD_RECEIVED → RE_VALIDATION_RUNNING
                                                                                              ↘ RESOLVED_PROCEED
                                                                                              ↘ VALIDATION_FAILED (循环)
```
人工操作只有两个出口：**放行**（附理由）或 **下发用户重新上传**。

### 介入点 3：规则引擎"转人工"（定责或定损阶段内）
**触发条件**：规则执行动作为 `ROUTE_CLAIM_MANUAL` 或 `needs_human_review: true`
**转人工原因**：`"规则 [规则名] 触发转人工：[route_reason]，如：责任比例缺失，需人工确认"`；或 `"规则 [规则名] 解析置信度 Y% 低于阈值，标记需人工复核"`

```
IDLE → MANUAL_REVIEW_TRIGGERED → PENDING_ADJUSTER → ADJUSTER_REVIEWING
  → DECISION_APPROVE → RESOLVED_PROCEED
  → DECISION_REJECT  → RESOLVED_PROCEED
  → DECISION_ADJUST  → RESOLVED_PROCEED
  → DECISION_REQUEST_INFO → PENDING_ADDITIONAL_INFO → INFO_RECEIVED → ADJUSTER_REVIEWING (循环)
                           ↘ RESOLVED_ROLLBACK (打回到受理阶段)
```

---

## 与主流水线的集成

新增阶段状态值：`awaiting_human`（等待人工处理），加入 `ClaimStageStatus`

| 阶段状态 | 子状态机是否激活 |
|---|---|
| `pending` / `processing` | 否 |
| **`awaiting_human`** (新增) | 是 - 介入实例激活 |
| `completed` / `manual_completed` | 否 - 已解决 |
| `failed` | 可能 |

**双向流转**：介入点3的 `RESOLVED_ROLLBACK` 会将目标阶段重置为 `processing`，所有下游阶段重置为 `pending`。介入点1和2不涉及打回主流程。

---

## UI 设计：工作台汇总 + 跳转详情页处理

### 工作台（ClaimWorkbenchPage）— 统一任务入口

在现有"审核任务"tab 中，将三种介入任务统一展示为任务列表：

| 列 | 说明 |
|---|---|
| 案件编号 | 关联的 ClaimCase ID，可点击 |
| 介入类型标签 | `置信度不足` / `校验不通过` / `规则转人工`，不同颜色区分 |
| **转人工原因** | 明确展示触发原因文案（见各介入点的转人工原因） |
| 关联阶段 | 解析 / 定责 / 定损 |
| 优先级 | 低 / 中 / 高 / 紧急 |
| 创建时间 | 介入实例创建时间 |
| 当前子状态 | 如"待理赔员审核"、"待用户重传"等 |
| 操作 | "去处理" 按钮 → 跳转详情页 |

**筛选项**：按介入类型、优先级、子状态筛选

### 跳转详情页（ClaimCaseDetailPage）— 定位到具体报错

点击"去处理"后跳转到 `ClaimCaseDetailPage`，根据介入类型自动定位：

**介入点1（置信度不足）**：
- 自动切换到"材料审阅"tab
- 自动选中对应文档
- **高亮标注**置信度低的字段，显示：原始AI值、置信度百分比、阈值
- 提供操作：修正字段值 / 接受原值 / 请求重新提取
- 顶部显示转人工原因横幅：`"字段「诊断名称」AI识别置信度 62%，低于阈值 80%"`

**介入点2（校验不通过）**：
- 自动切换到"材料审阅"tab
- 在材料面板上方显示**校验失败卡片**，包含：
  - 失败规则名称和 reason_code
  - 转人工原因：`"发票患者姓名「张三」与病历患者姓名「张叁」不一致"`
  - 左右字段对比展示（左字段值 vs 右字段值）
  - 操作按钮：**放行**（需填写放行理由）/ **下发重传**（选择需重传的材料）

**介入点3（规则转人工）**：
- 自动打开 `StageDecisionPanel` 弹窗
- 弹窗顶部显示转人工原因横幅：`"规则「责任比例判定」触发转人工：责任比例缺失，需人工确认"`
- 展示规则执行上下文（触发的规则名、条件、当前事实值）
- 操作按钮：通过 / 拒赔（附理由）/ 调整比例或金额 / 补充材料

### 转人工原因的数据结构

每个 `InterventionInstance` 携带 `reason` 字段：

```typescript
interface InterventionReason {
  code: string;              // 原因编码，如 "LOW_CONFIDENCE", "VALIDATION_FAILED", "RULE_ROUTE_MANUAL"
  summary: string;           // 一句话摘要，显示在工作台列表
  detail: string;            // 详细说明，显示在详情页横幅
  sourceField?: string;      // 相关字段（介入点1）
  sourceRuleId?: string;     // 相关规则ID（介入点2/3）
  sourceRuleName?: string;   // 相关规则名称
  confidence?: number;       // 置信度值（介入点1）
  threshold?: number;        // 阈值（介入点1）
  leftValue?: string;        // 左字段值（介入点2）
  rightValue?: string;       // 右字段值（介入点2）
  routeReason?: string;      // 规则路由原因（介入点3）
}
```

---

## 实施分三个阶段

### 第一阶段：类型定义 + 状态机引擎

**1.1 在 `types.ts`（第2277行之后）添加类型**
- `InterventionPointType`：`PARSE_LOW_CONFIDENCE | VALIDATION_GATE | RULE_MANUAL_ROUTE`
- 三组子状态类型：`ParseConfidenceSubState`、`ValidationGateSubState`、`RuleManualRouteSubState`
- `InterventionEvent` 联合类型（所有状态转移事件）
- `InterventionTransition` 接口（每次状态变更的审计记录）
- `InterventionInstance` 接口（完整介入实例，含 transitions、reason、decision 等）
- `InterventionReason` 接口（转人工原因的结构化数据）
- 扩展 `ClaimStageStatus` 增加 `"awaiting_human"`
- 扩展 `ClaimStageProgress` 增加 `activeInterventionId?`、`interventionType?`、`interventionSubState?`
- 扩展 `ClaimTimelineEventType` 增加：`INTERVENTION_CREATED`、`INTERVENTION_STATE_CHANGED`、`INTERVENTION_RESOLVED`、`ADJUSTER_OVERRIDE_APPLIED`、`REUPLOAD_REQUESTED`、`REUPLOAD_RECEIVED`、`RE_EXTRACTION_TRIGGERED`、`MANUAL_DECISION_MADE`、`ROLLBACK_INITIATED`

**1.2 新建 `server/services/interventionStateMachine.js`**
- 静态转移表：`{ [介入类型]: { [来源状态]: { [事件]: { 目标状态, 守卫条件 } } } }`
- `createIntervention(claimCaseId, stageKey, interventionType, reason, context)` → 创建并自动从 IDLE 转移
- `transitionState(interventionId, event, payload)` → 校验转移、更新状态、写审计记录、同步父阶段
- `resolveIntervention(interventionId, resolution)` → 标记已解决、更新父阶段
- `syncStageFromIntervention(intervention)` → 父阶段设为 `awaiting_human` / `manual_completed` / 打回
- 纯函数守卫条件

**1.3 新建 `jsonlist/claim-interventions.json`**（空数组）

**1.4 在 `server/apiHandler.js` 添加API端点**
- `GET /api/claim-interventions?claimCaseId={id}` - 查询案件介入实例
- `GET /api/claim-interventions` - 查询所有待处理介入（工作台用）
- `GET /api/claim-interventions/:id` - 单个介入实例详情
- `POST /api/claim-interventions/:id/transition` - 触发状态转移 `{ event, payload }`
- `POST /api/claim-interventions` - 手动创建介入

**1.5 在 `services/api.ts` 添加前端API调用**
- `api.interventions.list(filters)` - 工作台任务列表
- `api.interventions.get(id)` - 获取介入详情
- `api.interventions.transition(id, event, payload)` - 触发状态转移

### 第二阶段：后端集成

**2.1 修改 `server/services/claimReviewService.js`**
- `syncClaimStageFields()`：当决策为 `MANUAL_REVIEW` 时，调用 `createIntervention()` 并传入结构化的 `reason`
- `syncClaimReviewArtifacts()`：检查 `manualReviewReasons` 创建介入点3实例

**2.2 修改审核任务生命周期**
- 创建 LOW_CONFIDENCE/AI_ERROR 任务时 → 创建介入点1实例，reason 包含字段名、置信度、阈值
- 任务完成/取消 → 转移对应介入实例状态

**2.3 修改材料校验流程**
- 校验失败且 `failure_action === MANUAL_REVIEW` → 创建介入点2实例，reason 包含规则名、失败消息、左右字段值

**2.4 修改 `server/rules/actionExecutor.js`**
- `ROUTE_CLAIM_MANUAL` 分支增加 `intervention_required` 标识和 `route_reason`

**2.5 修改时间线服务**
- 读取 `claim-interventions.json`，为 `awaiting_human` 阶段填充 blockingReason
- 介入事件加入时间线

### 第三阶段：前端集成

**3.1 修改 `ClaimWorkbenchPage.tsx` — 工作台统一任务入口**
- 调用 `api.interventions.list()` 获取所有待处理介入任务
- 任务列表显示：案件编号、介入类型标签、**转人工原因摘要**、阶段、优先级、子状态
- 筛选：按介入类型、优先级、子状态
- "去处理"按钮：跳转 `ClaimCaseDetailPage`，URL 参数携带 `interventionId` 和 `interventionType`

**3.2 修改 `ClaimCaseDetailPage.tsx` — 跳转后自动定位**
- 接收 `interventionId` 参数，加载介入实例
- 根据 `interventionType` 自动定位：
  - `PARSE_LOW_CONFIDENCE`：切到材料审阅 tab，选中文档，高亮低置信度字段
  - `VALIDATION_GATE`：切到材料审阅 tab，顶部渲染校验失败卡片（规则名、原因、字段对比、放行/重传按钮）
  - `RULE_MANUAL_ROUTE`：自动打开 StageDecisionPanel 弹窗
- 所有操作面板顶部显示**转人工原因横幅**（紫色背景），内容来自 `intervention.reason.detail`

**3.3 修改 `ClaimAdjusterPanels.tsx`**
- `ManualProcessingPanel`：增加介入子状态标签、转移操作按钮
- `StageDecisionPanel`：增加转人工原因横幅、规则上下文展示
- **新增 `ValidationFailurePanel`**：校验不通过的专用操作面板（规则信息、字段对比、放行理由输入、重传材料选择）

**3.4 修改展示工具函数**
- `claimReviewPresentation.ts`：增加 `awaiting_human` 阶段卡片展示、`getInterventionSummary()` 辅助函数
- `claimTimelinePresentation.ts`：增加 `awaiting_human` 紫色主题 `border-purple-200 bg-purple-50 text-purple-700`，方法标签 "等待人工处理"

---

## 关键文件清单

| 文件 | 变更 |
|---|---|
| `types.ts:2232-2277` | 新增介入类型、InterventionReason，扩展 StageStatus/Progress/TimelineEventType |
| `server/services/interventionStateMachine.js` | **新建** - 状态机引擎 |
| `jsonlist/claim-interventions.json` | **新建** - 介入实例数据 |
| `server/apiHandler.js` | 新增5个介入API端点 |
| `services/api.ts` | 新增前端介入API调用 |
| `server/services/claimReviewService.js` | 在人工审核触发时创建介入实例 + reason |
| `server/rules/actionExecutor.js` | ROUTE_CLAIM_MANUAL 标记介入需求 |
| `components/ClaimWorkbenchPage.tsx` | 统一介入任务列表 + 跳转 |
| `components/ClaimCaseDetailPage.tsx` | 接收 interventionId 自动定位 + 原因横幅 |
| `components/claim-adjuster/ClaimAdjusterPanels.tsx` | 扩展面板 + 新增 ValidationFailurePanel |
| `utils/claimReviewPresentation.ts` | awaiting_human 展示 |
| `utils/claimTimelinePresentation.ts` | 紫色主题 |

## 复用已有模式

- **审计追踪**：沿用 `ClaimTimelineEvent` 模式记录介入转移
- **阶段同步**：扩展 `syncClaimStageFields()` 模式，不替换
- **ReviewTask 关联**：用已有 `reviewTaskId` 关联介入点1
- **JSON 文件读写**：沿用 `apiHandler.js` 中 `readData/writeData` 模式
- **不可变更新**：所有状态转移返回新对象

## 验证方式

1. **状态机单测**：每个介入点的转移表，验证合法转移通过、非法转移拒绝
2. **手动 E2E 流程**：
   - 介入点1：设置材料置信度低于阈值 → 工作台出现任务（显示"字段X置信度62%低于80%"）→ 跳转详情页 → 高亮字段 → 修正 → 案件继续到定责
   - 介入点2：触发校验规则失败 → 工作台出现任务（显示"发票患者姓名与病历不一致"）→ 跳转详情页 → 校验失败卡片 → 放行或下发重传
   - 介入点3：执行 ROUTE_CLAIM_MANUAL 规则 → 工作台出现任务（显示"责任比例缺失，需人工确认"）→ 跳转详情页 → StageDecisionPanel → 通过/拒赔/调整
3. **转人工原因验证**：确认工作台列表和详情页横幅都正确显示结构化的转人工原因
4. **时间线验证**：介入转移事件正确出现在案件时间线中
