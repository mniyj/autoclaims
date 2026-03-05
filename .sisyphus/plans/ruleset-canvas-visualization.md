# 规则集画布可视化 - 工作计划

## TL;DR

> **目标**：为"规则集管理"页面添加决策树画布可视化（只读视图）
> 
> **技术栈**：React Flow (@xyflow/react) + Dagre 自动布局
> 
> **交付物**：
> - RulesetFlowCanvas.tsx（画布组件）
> - rulesetFlowTransformer.ts（数据转换器）
> - 3种自定义节点组件（LogicGate/Condition/Action）
> - RulesetDetailView.tsx 新增"可视化"标签
> 
> **估算时间**：6-8小时（今日可完成）
> **并行执行**：YES（Wave 1 和 Wave 2 可并行）

---

## Context

### 原始需求
在"规则集管理"页面下，每个规则集用画布展示，可视化看到大的决策树。

### 需求确认
- **优先级**：高
- **范围**：只读视图（v1），与现有功能共存
- **复杂度**：大型规则集（100+节点）
- **展示模式**：简洁模式（图标+简短标签）

### 现有代码结构
- `types.ts:748-1013` - RulesetRule 和条件树类型定义
- `components/ruleset/RulesetDetailView.tsx` - 规则集详情页（需修改）
- `components/ruleset/ConditionTreeBuilder.tsx` - 现有树形编辑器（参考）
- 无现有画布/可视化库

---

## Work Objectives

### 核心目标
实现规则集决策树的可视化展示，让复杂的业务规则一目了然。

### 具体交付物
1. **数据转换层**：将 RuleConditions 转换为 React Flow 格式
2. **画布组件**：集成 React Flow，支持缩放、平移、点击查看
3. **自定义节点**：3种节点类型（逻辑门、条件、动作）
4. **自动布局**：Dagre 算法自动计算节点位置
5. **UI集成**：RulesetDetailView 新增"可视化"标签页

### 完成标准
- [ ] 能在规则集详情页切换到"可视化"标签
- [ ] 正确渲染规则的决策树结构
- [ ] 支持100+节点的流畅展示
- [ ] 点击节点在侧边栏显示详情

### 明确排除（范围边界）
- ❌ 节点拖拽编辑
- ❌ 画布上直接修改规则
- ❌ 添加/删除节点功能
- ❌ 实时协作/同步编辑

---

## Verification Strategy

### 测试策略
- **单元测试**：无（项目无测试框架）
- **集成测试**：无
- **验证方式**：Agent 通过 Playwright 执行 QA Scenarios

### QA Policy
每个任务完成后，执行 Playwright 场景验证：
- 导航到规则集详情页
- 切换到可视化标签
- 验证画布渲染
- 截图保存为证据

---

## Execution Strategy

### 并行执行波次

```
Wave 1 (开始即执行 - 依赖安装 + 数据层):
├── Task 1: 安装 React Flow 和 Dagre [quick]
└── Task 2: 创建数据转换器 rulesetFlowTransformer.ts [unspecified-high]

Wave 2 (与 Wave 1 并行 - UI 组件):
├── Task 3: 创建自定义节点组件 (LogicGate/Condition/Action) [visual-engineering]
└── Task 4: 创建画布主组件 RulesetFlowCanvas.tsx [unspecified-high]

Wave 3 (Wave 1+2 完成后 - 集成):
├── Task 5: 集成到 RulesetDetailView.tsx 添加标签 [quick]
└── Task 6: 创建节点详情侧边栏 [visual-engineering]

Wave 4 (优化):
├── Task 7: 性能优化和边界处理 [unspecified-high]
└── Task 8: 最终 QA 验证 [unspecified-high]

Critical Path: Task 1 → Task 2 → Task 4 → Task 5 → Task 8
Max Concurrent: 2 任务
```

---

## TODOs

### Task 1: 安装 React Flow 和 Dagre

**What to do**:
- 安装依赖包
- 验证安装成功

**Commands**:
```bash
npm install @xyflow/react dagre
npm install --save-dev @types/dagre
```

**Must NOT do**:
- 不要安装其他可视化库（避免冲突）
- 不要修改现有依赖版本

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: []

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1
- **Blocks**: Task 2, Task 4
- **Blocked By**: None

**References**:
- `package.json` - 查看现有依赖

**Acceptance Criteria**:
- [ ] `@xyflow/react` 出现在 package.json dependencies
- [ ] `dagre` 出现在 package.json dependencies
- [ ] `npm list @xyflow/react` 返回版本号

**QA Scenarios**:
```
Scenario: 依赖安装成功
  Tool: Bash
  Steps:
    1. cat package.json | grep '@xyflow/react'
    2. cat package.json | grep 'dagre'
  Expected Result: 两行都返回非空结果
  Evidence: .sisyphus/evidence/task-1-deps-installed.txt
```

**Commit**: NO (合并到 Task 8)

---

### Task 2: 创建数据转换器 rulesetFlowTransformer.ts

**What to do**:
- 在 `utils/` 目录创建转换器
- 将 `RulesetRule` 的 `conditions` 转换为 React Flow 节点和边
- 使用 Dagre 计算节点位置

**Implementation Details**:
```typescript
// utils/rulesetFlowTransformer.ts
export interface FlowNode {
  id: string;
  type: 'logicGate' | 'condition' | 'action';
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    operator?: 'AND' | 'OR' | 'NOT';
    field?: string;
    value?: any;
    action?: string;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
}

export function ruleToFlowElements(
  rule: RulesetRule
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  // 递归遍历 conditions 树
  // 为每个节点生成唯一 ID: ruleId_condition_path
  // 使用 Dagre 自动布局
}
```

**Must NOT do**:
- 不要修改原始 rule 数据（纯函数转换）
- 不要引入副作用

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**Parallelization**:
- **Can Run In Parallel**: YES (与 Task 3 并行)
- **Parallel Group**: Wave 1
- **Blocks**: Task 4
- **Blocked By**: Task 1

**References**:
- `types.ts:748-850` - RulesetRule 和 Condition 类型
- `types.ts:850-920` - GroupCondition 和 LeafCondition
- `components/ruleset/ConditionTreeBuilder.tsx` - 现有树遍历逻辑（参考）

**Acceptance Criteria**:
- [ ] 文件创建: `utils/rulesetFlowTransformer.ts`
- [ ] 导出函数: `ruleToFlowElements`
- [ ] 输入: `RulesetRule` 对象
- [ ] 输出: `{ nodes: FlowNode[], edges: FlowEdge[] }`
- [ ] 节点 ID 格式: `{ruleId}_cond_{path}` (如: "rule123_cond_0_1_2")

**QA Scenarios**:
```
Scenario: 转换简单规则
  Tool: Bash (bun test runner 或 Node REPL)
  Preconditions: 准备一个包含简单条件的 RulesetRule
  Steps:
    1. 导入转换器
    2. 调用 ruleToFlowElements(simpleRule)
    3. 验证返回 nodes 和 edges 数组
  Expected Result: 
    - nodes.length > 0
    - edges.length === nodes.length - 1 (树形结构)
    - 每个节点有 id, type, position, data
  Evidence: .sisyphus/evidence/task-2-transformer-works.json

Scenario: 处理复杂嵌套规则
  Tool: Bash
  Steps:
    1. 准备包含 AND/OR/NOT 嵌套的规则
    2. 调用转换器
    3. 验证逻辑门节点正确生成
  Expected Result:
    - 逻辑门节点 type === 'logicGate'
    - 边正确连接父子节点
  Evidence: .sisyphus/evidence/task-2-nested-rule.json
```

**Commit**: NO (合并到 Task 8)

---

### Task 3: 创建自定义节点组件

**What to do**:
- 在 `components/ruleset/flow/` 目录创建3种节点组件
- 使用 Tailwind CSS 样式

**Files to Create**:
1. `components/ruleset/flow/LogicGateNode.tsx` - 菱形/六边形逻辑门
2. `components/ruleset/flow/ConditionNode.tsx` - 圆角矩形条件
3. `components/ruleset/flow/ActionNode.tsx` - 绿色胶囊动作

**Must NOT do**:
- 不要在节点内嵌入复杂表单（只读模式）
- 不要引入外部 CSS 文件（Tailwind 内联）

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: []

**Parallelization**:
- **Can Run In Parallel**: YES (与 Task 2 并行)
- **Parallel Group**: Wave 2
- **Blocks**: Task 4
- **Blocked By**: None

**References**:
- React Flow 文档: https://reactflow.dev/learn/customization/custom-nodes
- 项目样式: `components/ui/` - Button, Modal 等现有组件
- 颜色系统: `index.html` 中 Tailwind 配置

**Node Designs**:

**LogicGateNode**:
```tsx
// 菱形或六边形，显示 AND/OR/NOT
<div className="w-24 h-24 bg-yellow-100 border-2 border-yellow-500 
                flex items-center justify-center transform rotate-45">
  <span className="transform -rotate-45 font-bold text-yellow-800">
    {data.operator}
  </span>
</div>
```

**ConditionNode**:
```tsx
// 圆角矩形，显示字段和操作符
<div className="px-4 py-2 bg-white rounded-lg shadow-md border-2 border-blue-400 min-w-[150px]">
  <div className="text-xs text-gray-500 truncate">{data.field}</div>
  <div className="text-sm font-medium text-gray-800 truncate">
    {data.operator} {data.value}
  </div>
</div>
```

**ActionNode**:
```tsx
// 绿色胶囊，显示动作类型
<div className="px-6 py-2 bg-green-100 rounded-full border-2 border-green-500">
  <span className="text-sm font-medium text-green-800">{data.action}</span>
</div>
```

**Acceptance Criteria**:
- [ ] 3个文件创建成功
- [ ] 每个组件接受 `NodeProps` 类型的 props
- [ ] 使用 Tailwind 内联样式（无 CSS 文件）
- [ ] 每个节点有连接点（Handle）供边连接

**QA Scenarios**:
```
Scenario: 节点组件渲染
  Tool: Playwright
  Preconditions: 创建测试页面展示3种节点
  Steps:
    1. 打开测试页面
    2. 截图验证3种节点外观
  Expected Result:
    - LogicGateNode 显示 AND/OR/NOT
    - ConditionNode 显示字段和操作符
    - ActionNode 显示动作类型
  Evidence: .sisyphus/evidence/task-3-nodes.png
```

**Commit**: NO (合并到 Task 8)

---

### Task 4: 创建画布主组件 RulesetFlowCanvas.tsx

**What to do**:
- 创建主画布组件
- 集成 React Flow、节点类型、布局
- 处理缩放、平移、点击事件

**File**: `components/ruleset/RulesetFlowCanvas.tsx`

**Key Features**:
- ReactFlowProvider 包裹
- 自定义节点类型映射
- Dagre 自动布局
- Controls（缩放控制）
- MiniMap（小地图）
- 点击节点回调

**Props Interface**:
```typescript
interface RulesetFlowCanvasProps {
  rule: RulesetRule;
  onNodeClick?: (node: FlowNode) => void;
  className?: string;
}
```

**Must NOT do**:
- 不要在此组件内处理状态管理（props 驱动）
- 不要引入复杂副作用

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 2
- **Blocks**: Task 5
- **Blocked By**: Task 1, Task 2, Task 3

**References**:
- React Flow Quick Start: https://reactflow.dev/learn/getting-started/adding-interactivity
- `components/ruleset/flow/` - Task 3 创建的节点
- `utils/rulesetFlowTransformer.ts` - Task 2 创建的转换器

**Acceptance Criteria**:
- [ ] 文件创建: `components/ruleset/RulesetFlowCanvas.tsx`
- [ ] 接受 `rule` prop 并渲染决策树
- [ ] 支持缩放、平移
- [ ] 点击节点触发 `onNodeClick` 回调
- [ ] 画布自适应容器尺寸

**QA Scenarios**:
```
Scenario: 画布渲染规则树
  Tool: Playwright
  Preconditions: 
    - RulesetDetailView 已修改添加此组件
    - 访问一个包含规则集的页面
  Steps:
    1. 导航到 /rulesets/{id}
    2. 切换到"可视化"标签
    3. 等待画布加载
    4. 截图保存
  Expected Result:
    - 画布区域可见
    - 至少显示一个节点
    - 缩放/平移控件可见
  Evidence: .sisyphus/evidence/task-4-canvas-render.png

Scenario: 节点点击交互
  Tool: Playwright
  Steps:
    1. 点击画布上的一个节点
    2. 验证 onNodeClick 被触发
  Expected Result: 侧边栏显示节点详情（Task 6 实现）
  Evidence: .sisyphus/evidence/task-4-node-click.png
```

**Commit**: NO (合并到 Task 8)

---

### Task 5: 集成到 RulesetDetailView.tsx

**What to do**:
- 在 RulesetDetailView 添加"可视化"标签
- 导入并渲染 RulesetFlowCanvas

**File**: `components/ruleset/RulesetDetailView.tsx`

**Changes**:
1. 导入 RulesetFlowCanvas
2. 在 tabs 数组中添加 "可视化" 标签
3. 在 tab 内容区域添加画布渲染

**Current Tabs** (参考):
```tsx
const tabs = [
  { id: 'rules', label: '规则列表' },
  { id: 'pipeline', label: '执行管道' },
  { id: 'overrides', label: '冲突链' },
  { id: 'fields', label: '字段字典' },
];
```

**New Tabs**:
```tsx
const tabs = [
  { id: 'rules', label: '规则列表' },
  { id: 'visualization', label: '可视化' },  // 新增
  { id: 'pipeline', label: '执行管道' },
  { id: 'overrides', label: '冲突链' },
  { id: 'fields', label: '字段字典' },
];
```

**Must NOT do**:
- 不要移除现有标签
- 不要修改其他标签的内容

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: []

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 3
- **Blocks**: Task 6
- **Blocked By**: Task 4

**References**:
- `components/ruleset/RulesetDetailView.tsx` - 完整文件
- `components/ruleset/RulesetFlowCanvas.tsx` - Task 4 创建

**Acceptance Criteria**:
- [ ] "可视化"标签出现在标签栏
- [ ] 切换标签显示画布
- [ ] 画布正确接收 rule 数据

**QA Scenarios**:
```
Scenario: 标签切换
  Tool: Playwright
  Steps:
    1. 访问规则集详情页
    2. 点击"可视化"标签
    3. 等待画布加载
    4. 截图验证
  Expected Result:
    - 可视化标签高亮
    - 画布区域可见且渲染了决策树
  Evidence: .sisyphus/evidence/task-5-tab-switch.png
```

**Commit**: NO (合并到 Task 8)

---

### Task 6: 创建节点详情侧边栏

**What to do**:
- 在 RulesetDetailView 添加侧边栏
- 点击节点时显示节点详情

**Features**:
- 滑出式侧边栏（右侧）
- 显示节点完整信息
- 区分不同类型节点的字段

**UI Design**:
```
┌─────────────────────────────────────┬─────────────┐
│                                     │  节点详情   │
│         Canvas Area                 │  ─────────  │
│         (React Flow)                │  类型: AND  │
│                                     │  字段: ...  │
│                                     │  值: ...    │
│                                     │             │
└─────────────────────────────────────┴─────────────┘
```

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: []

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 3
- **Blocks**: Task 7
- **Blocked By**: Task 5

**References**:
- `components/ui/` - Modal, Button 等 UI 组件
- Tailwind 侧边栏样式参考

**Acceptance Criteria**:
- [ ] 侧边栏组件创建
- [ ] 点击画布节点打开侧边栏
- [ ] 侧边栏显示节点完整信息
- [ ] 关闭按钮正常工作

**QA Scenarios**:
```
Scenario: 侧边栏显示详情
  Tool: Playwright
  Steps:
    1. 打开可视化标签
    2. 点击一个条件节点
    3. 验证侧边栏滑出并显示详情
  Expected Result:
    - 侧边栏可见
    - 显示字段、操作符、值等信息
  Evidence: .sisyphus/evidence/task-6-sidebar.png
```

**Commit**: NO (合并到 Task 8)

---

### Task 7: 性能优化和边界处理

**What to do**:
- 优化100+节点的渲染性能
- 处理空规则、异常数据等边界情况

**Optimizations**:
1. **Memoization**: 用 `React.memo` 包裹自定义节点
2. **Lazy Loading**: 初始只渲染视口内节点
3. **Node Limit**: 超过200节点显示警告提示
4. **Error Boundary**: 防止转换错误导致页面崩溃

**Must NOT do**:
- 不要过早优化（先确保功能正确）

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 4
- **Blocks**: Task 8
- **Blocked By**: Task 6

**References**:
- React Flow Performance: https://reactflow.dev/learn/advanced-performance

**Acceptance Criteria**:
- [ ] 自定义节点使用 `React.memo`
- [ ] 大数据集（>100节点）流畅渲染
- [ ] 空规则显示友好提示
- [ ] 转换错误不崩溃，显示错误提示

**QA Scenarios**:
```
Scenario: 大数据集性能
  Tool: Playwright
  Preconditions: 准备一个包含150+节点的规则
  Steps:
    1. 打开该规则的可视化
    2. 测量加载时间
    3. 测试缩放/平移流畅度
  Expected Result:
    - 加载时间 < 3秒
    - 交互无明显卡顿
  Evidence: .sisyphus/evidence/task-7-performance.log
```

**Commit**: NO (合并到 Task 8)

---

### Task 8: 最终 QA 验证和提交

**What to do**:
- 完整功能测试
- TypeScript 类型检查
- 提交所有变更

**Verification Steps**:
1. 类型检查: `npx tsc --noEmit`
2. 功能测试: 访问多个规则集，验证渲染
3. 性能测试: 测试大数据集
4. Git 提交

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 4
- **Blocks**: None
- **Blocked By**: Task 7

**Acceptance Criteria**:
- [ ] TypeScript 无错误
- [ ] 至少3个不同规则集正确渲染
- [ ] 所有 QA 场景通过
- [ ] Git commit 成功

**QA Scenarios**:
```
Scenario: 端到端验证
  Tool: Playwright + Bash
  Steps:
    1. npm run dev 启动开发服务器
    2. 登录系统，导航到规则集管理
    3. 打开3个不同的规则集详情
    4. 切换到可视化标签
    5. 验证每个都正确渲染
    6. 截图保存
    7. 运行类型检查
  Expected Result:
    - 所有规则集画布正常显示
    - TypeScript 无错误
    - 截图显示正确渲染
  Evidence: 
    - .sisyphus/evidence/task-8-e2e-{ruleset1,ruleset2,ruleset3}.png
    - .sisyphus/evidence/task-8-typecheck.txt

Scenario: 提交代码
  Tool: Bash
  Steps:
    1. git add .
    2. git commit -m "feat: 添加规则集决策树画布可视化"
  Expected Result:
    - Commit 成功
    - 包含所有新增文件
  Evidence: .sisyphus/evidence/task-8-commit.txt
```

**Commit**: YES
- Message: `feat(ruleset): 添加规则集决策树画布可视化`
- Files: 
  - `package.json`
  - `package-lock.json`
  - `utils/rulesetFlowTransformer.ts`
  - `components/ruleset/flow/*.tsx`
  - `components/ruleset/RulesetFlowCanvas.tsx`
  - `components/ruleset/RulesetDetailView.tsx`
- Pre-commit: `npx tsc --noEmit`

---

## Final Verification Wave

### F1. 功能完整性验证
- [ ] 所有规则集详情页都有"可视化"标签
- [ ] 标签切换正常
- [ ] 画布渲染决策树
- [ ] 节点详情侧边栏工作

### F2. 代码质量验证
- [ ] TypeScript 类型检查通过
- [ ] 无 console.log 残留
- [ ] 代码注释完整（中文业务，英文技术）

### F3. 性能验证
- [ ] 100节点规则集流畅
- [ ] 初始加载 < 3秒
- [ ] 内存无泄漏

---

## Commit Strategy

**单提交**（合并所有任务）：
- 类型: `feat`
- 范围: `ruleset`
- 描述: 添加规则集决策树画布可视化

```
feat(ruleset): 添加规则集决策树画布可视化

- 安装 @xyflow/react 和 dagre 依赖
- 创建规则集到 Flow 元素的数据转换器
- 实现3种自定义节点组件（LogicGate/Condition/Action）
- 创建 RulesetFlowCanvas 画布组件
- 在 RulesetDetailView 添加"可视化"标签页
- 添加节点详情侧边栏
- 优化大数据集渲染性能

Refs: #规则集可视化
```

---

## Success Criteria

### 功能检查清单
- [x] 用户可以在规则集详情页切换到"可视化"标签
- [x] 画布正确渲染规则的决策树结构
- [x] 支持100+节点的流畅展示
- [x] 点击节点在侧边栏显示详情
- [x] 与现有功能（规则列表、执行管道等）共存

### 技术检查清单
- [x] TypeScript 类型检查通过
- [x] 使用 Tailwind CSS 内联样式
- [x] 代码符合项目规范（中文业务，英文技术）
- [x] 无破坏性变更

### 性能检查清单
- [x] 100节点规则集渲染时间 < 3秒
- [x] 交互（缩放/平移）无明显卡顿
- [x] 空规则集显示友好提示

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| React Flow 与 React 19 兼容性问题 | 低 | 高 | 快速验证安装，有问题立即回退 |
| 大数据集性能不达标 | 中 | 中 | v1只读模式，减少交互开销 |
| 数据转换器复杂度过高 | 中 | 中 | 参考现有 ConditionTreeBuilder |
| 时间超出预期 | 高 | 中 | 聚焦核心功能，优化可延后 |

**应急方案**：如果时间不够，可只完成 Wave 1-2（基础渲染），Wave 3-4（交互优化）延后。
